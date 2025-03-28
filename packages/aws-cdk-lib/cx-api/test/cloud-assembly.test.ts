import * as path from 'path';
import { testDeprecated } from '@aws-cdk/cdk-build-tools';
import { CloudAssembly } from '../lib';

const FIXTURES = path.join(__dirname, 'fixtures');

test('empty assembly', () => {
  const assembly = new CloudAssembly(path.join(FIXTURES, 'empty'));
  expect(assembly.artifacts).toEqual([]);
  expect(assembly.runtime).toEqual({ libraries: { } });
  expect(assembly.stacks).toEqual([]);
  expect(assembly.version).toEqual('0.0.0');
  expect(assembly.manifest).toMatchSnapshot();
  expect(assembly.tree()).toBeUndefined();
});

test('assembly with a single cloudformation stack and tree metadata', () => {
  const assembly = new CloudAssembly(path.join(FIXTURES, 'single-stack'));
  expect(assembly.artifacts).toHaveLength(2);
  expect(assembly.stacks).toHaveLength(1);
  expect(assembly.manifest.missing).toBeUndefined();
  expect(assembly.runtime).toEqual({ libraries: { } });

  const stack = assembly.stacks[0];
  expect(stack.manifest).toMatchSnapshot();
  expect(stack.assets).toHaveLength(0);
  expect(stack.dependencies).toEqual([]);
  expect(stack.environment).toEqual({ account: '37736633', region: 'us-region-1', name: 'aws://37736633/us-region-1' });
  expect(stack.template).toEqual({ Resources: { MyBucket: { Type: 'AWS::S3::Bucket' } } });
  expect(stack.messages).toEqual([]);
  expect(stack.manifest.metadata).toEqual(undefined);
  expect(stack.originalName).toEqual('MyStackName');
  expect(stack.stackName).toEqual('MyStackName');
  expect(stack.id).toEqual('MyStackName');

  const treeArtifact = assembly.tree();
  expect(treeArtifact).toBeDefined();
  expect(treeArtifact!.file).toEqual('foo.tree.json');
  expect(treeArtifact!.manifest).toMatchSnapshot();
});

test('assembly with invalid tree metadata', () => {
  const assembly = new CloudAssembly(path.join(FIXTURES, 'invalid-manifest-type-tree'));
  expect(() => assembly.tree()).toThrow(/Multiple artifacts/);
});

test('assembly with tree metadata having no file property specified', () => {
  expect(() => new CloudAssembly(path.join(FIXTURES, 'tree-no-file-property'))).toThrow(/Invalid assembly manifest/);
});

test('assembly with cloudformation artifact having no environment property specified', () => {
  expect(() => new CloudAssembly(path.join(FIXTURES, 'invalid-manifest-type-cloudformation'))).toThrow(/Invalid CloudFormation stack artifact/);
});

test('assembly with missing context', () => {
  const assembly = new CloudAssembly(path.join(FIXTURES, 'missing-context'));
  expect(assembly.manifest.missing).toMatchSnapshot();
});

test('assembly with multiple stacks', () => {
  const assembly = new CloudAssembly(path.join(FIXTURES, 'multiple-stacks'));
  expect(assembly.stacks).toHaveLength(2);
  expect(assembly.artifacts).toHaveLength(2);
});

test('fails for invalid environment format', () => {
  expect(() => new CloudAssembly(path.join(FIXTURES, 'invalid-env-format')))
    .toThrow('Unable to parse environment specification');
});

test('fails if stack artifact does not have properties', () => {
  expect(() => new CloudAssembly(path.join(FIXTURES, 'stack-without-params')))
    .toThrow('Invalid CloudFormation stack artifact. Missing \"templateFile\" property in cloud assembly manifest');
});

test('messages', () => {
  const assembly = new CloudAssembly(path.join(FIXTURES, 'messages'));
  expect(assembly.stacks[0].messages).toMatchSnapshot();
});

test('assets', () => {
  const assembly = new CloudAssembly(path.join(FIXTURES, 'assets'));
  expect(assembly.stacks[0].assets).toMatchSnapshot();
});

test('can-read-0.36.0', () => {
  // WHEN
  new CloudAssembly(path.join(FIXTURES, 'single-stack-0.36'));
  // THEN: no exception
  expect(true).toBeTruthy();
});

test('dependencies', () => {
  const assembly = new CloudAssembly(path.join(FIXTURES, 'depends'));
  expect(assembly.stacks).toHaveLength(4);

  // expect stacks to be listed in topological order
  expect(assembly.stacks.map(s => s.id)).toEqual(['StackA', 'StackD', 'StackC', 'StackB']);
  expect(assembly.stacks[0].dependencies).toEqual([]);
  expect(assembly.stacks[1].dependencies).toEqual([]);
  expect(assembly.stacks[2].dependencies.map(x => x.id)).toEqual(['StackD']);
  expect(assembly.stacks[3].dependencies.map(x => x.id)).toEqual(['StackC', 'StackD']);
});

test('fails for invalid dependencies', () => {
  expect(() => new CloudAssembly(path.join(FIXTURES, 'invalid-depends'))).toThrow('Artifact StackC depends on non-existing artifact StackX');
});

testDeprecated('stack artifacts can specify an explicit stack name that is different from the artifact id', () => {
  const assembly = new CloudAssembly(path.join(FIXTURES, 'explicit-stack-name'));

  expect(assembly.getStackByName('TheStackName').stackName).toStrictEqual('TheStackName');
  expect(assembly.getStackByName('TheStackName').id).toStrictEqual('stackid1');

  // deprecated but still test
  expect(assembly.getStack('TheStackName').stackName).toStrictEqual('TheStackName');
  expect(assembly.getStack('TheStackName').id).toStrictEqual('stackid1');
});

test('getStackByName fails if there are multiple stacks with the same name', () => {
  const assembly = new CloudAssembly(path.join(FIXTURES, 'multiple-stacks-same-name'));
  // eslint-disable-next-line max-len
  expect(() => assembly.getStackByName('the-physical-name-of-the-stack')).toThrow(/There are multiple stacks with the stack name \"the-physical-name-of-the-stack\" \(stack1\,stack2\)\. Use \"getStackArtifact\(id\)\" instead/);
});

test('getStackArtifact retrieves a stack by artifact id', () => {
  const assembly = new CloudAssembly(path.join(FIXTURES, 'multiple-stacks-same-name'));

  expect(assembly.getStackArtifact('stack1').stackName).toEqual('the-physical-name-of-the-stack');
  expect(assembly.getStackArtifact('stack2').stackName).toEqual('the-physical-name-of-the-stack');
  expect(assembly.getStackArtifact('stack2').id).toEqual('stack2');
  expect(assembly.getStackArtifact('stack1').id).toEqual('stack1');
});

test('displayName shows hierarchical ID for nested stack without explicit stackName', () => {
  const assembly = new CloudAssembly(path.join(FIXTURES, 'nested-stacks'));
  const stackArtifact = assembly.getStackArtifact('topLevelStackNestedStackDAC87084');
  expect(stackArtifact.hierarchicalId).toStrictEqual('topLevelStack/nestedStack');
  expect(stackArtifact.displayName).toStrictEqual('topLevelStack/nestedStack');
});

test('displayName shows hierarchical ID and stackName for nested stack with explicit stackName', () => {
  const assembly = new CloudAssembly(path.join(FIXTURES, 'nested-stacks'));
  const nestedStack = assembly.getStackArtifact('topLevelStackNestedStackWithStackName6D28EAEF');
  expect(nestedStack.hierarchicalId).toStrictEqual('topLevelStack/nestedStackWithStackName');
  expect(nestedStack.stackName).toStrictEqual('explicitStackName');
  expect(nestedStack.displayName).toStrictEqual('topLevelStack/nestedStackWithStackName (explicitStackName)');
});

test('displayName shows both hierarchical ID and stack name if needed', () => {
  const a1 = new CloudAssembly(path.join(FIXTURES, 'multiple-stacks-same-name'));
  expect(a1.getStackArtifact('stack1').displayName).toStrictEqual('stack1 (the-physical-name-of-the-stack)');
  expect(a1.getStackArtifact('stack2').displayName).toStrictEqual('stack2 (the-physical-name-of-the-stack)');

  const a2 = new CloudAssembly(path.join(FIXTURES, 'single-stack'));
  const art1 = a2.getStackArtifact('MyStackName');
  const art2 = a2.getStackByName('MyStackName');

  expect(art1).toBe(art2);
  expect(art1.displayName).toBe('MyStackName');
  expect(art1.id).toBe('MyStackName');
  expect(art1.stackName).toBe('MyStackName');
});

test('can read assembly with asset manifest', () => {
  const assembly = new CloudAssembly(path.join(FIXTURES, 'asset-manifest'));
  expect(assembly.stacks).toHaveLength(1);
  expect(assembly.artifacts).toHaveLength(2);
});

test('can toposort assembly with asset dependency', () => {
  const assembly = new CloudAssembly(path.join(FIXTURES, 'asset-depends'));
  expect(assembly.stacks).toHaveLength(2);
  expect(assembly.artifacts).toHaveLength(3);
  expect(assembly.artifacts[0].id).toEqual('StagingStack');
});

test('getStackArtifact retrieves a stack by artifact id from a nested assembly', () => {
  const assembly = new CloudAssembly(path.join(FIXTURES, 'nested-assemblies'));

  expect(assembly.getStackArtifact('topLevelStack').stackName).toEqual('topLevelStack');
  expect(assembly.getStackArtifact('stack1').stackName).toEqual('first-stack');
  expect(assembly.getStackArtifact('stack2').stackName).toEqual('second-stack');
  expect(assembly.getStackArtifact('topLevelStack').id).toEqual('topLevelStack');
  expect(assembly.getStackArtifact('stack1').id).toEqual('stack1');
  expect(assembly.getStackArtifact('stack2').id).toEqual('stack2');
});

test('isCloudAssembly correctly detects Cloud Assemblies', () => {
  const assembly = new CloudAssembly(path.join(FIXTURES, 'nested-assemblies'));
  const inheritedAssembly = new (class extends CloudAssembly {})(path.join(FIXTURES, 'nested-assemblies'));

  expect(CloudAssembly.isCloudAssembly(assembly)).toBe(true);
  expect(CloudAssembly.isCloudAssembly(inheritedAssembly)).toBe(true);
  expect(CloudAssembly.isCloudAssembly({})).toBe(false);
});
