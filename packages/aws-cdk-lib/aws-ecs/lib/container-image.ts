/* eslint-disable import/order */
import { Construct } from 'constructs';
import { ContainerDefinition } from './container-definition';
import { CfnTaskDefinition } from './ecs.generated';
import * as ecr from '../../aws-ecr';
import { DockerImageAsset, TarballImageAsset } from '../../aws-ecr-assets';

/**
 * Constructs for types of container images
 */
export abstract class ContainerImage {
  /**
   * Reference an image on DockerHub or another online registry
   */
  public static fromRegistry(name: string, props: RepositoryImageProps = {}) {
    return new RepositoryImage(name, props);
  }

  /**
   * Reference an image in an ECR repository
   *
   * @param tag If you don't specify this parameter, `latest` is used as default.
   */
  public static fromEcrRepository(repository: ecr.IRepository, tag: string = 'latest') {
    return new EcrImage(repository, tag);
  }

  /**
   * Reference an image that's constructed directly from sources on disk.
   *
   * If you already have a `DockerImageAsset` instance, you can use the
   * `ContainerImage.fromDockerImageAsset` method instead.
   *
   * @param directory The directory containing the Dockerfile
   */
  public static fromAsset(directory: string, props: AssetImageProps = {}) {
    return new AssetImage(directory, props);
  }

  /**
   * Use an existing `DockerImageAsset` for this container image.
   *
   * @param asset The `DockerImageAsset` to use for this container definition.
   */
  public static fromDockerImageAsset(asset: DockerImageAsset): ContainerImage {
    return {
      bind(_scope: Construct, containerDefinition: ContainerDefinition): ContainerImageConfig {
        containerDefinition._defaultDisableVersionConsistency?.();
        asset.repository.grantPull(containerDefinition.taskDefinition.obtainExecutionRole());
        return {
          imageName: asset.imageUri,
        };
      },
    };
  }

  /**
   * Use an existing tarball for this container image.
   *
   * Use this method if the container image has already been created by another process (e.g. jib)
   * and you want to add it as a container image asset.
   *
   * @param tarballFile Absolute path to the tarball. You can use language-specific idioms (such as `__dirname` in Node.js)
   *                    to create an absolute path based on the current script running directory.
   */
  public static fromTarball(tarballFile: string): ContainerImage {
    return {
      bind(scope: Construct, containerDefinition: ContainerDefinition): ContainerImageConfig {
        const asset = new TarballImageAsset(scope, 'Tarball', { tarballFile });
        asset.repository.grantPull(containerDefinition.taskDefinition.obtainExecutionRole());

        return {
          imageName: asset.imageUri,
        };
      },
    };
  }

  /**
   * Called when the image is used by a ContainerDefinition
   */
  public abstract bind(scope: Construct, containerDefinition: ContainerDefinition): ContainerImageConfig;
}

/**
 * The configuration for creating a container image.
 */
export interface ContainerImageConfig {
  /**
   * Specifies the name of the container image.
   */
  readonly imageName: string;

  /**
   * Specifies the credentials used to access the image repository.
   */
  readonly repositoryCredentials?: CfnTaskDefinition.RepositoryCredentialsProperty;
}

// These imports have to be at the end to prevent circular imports
import { AssetImage, AssetImageProps } from './images/asset-image';
import { EcrImage } from './images/ecr';
import { RepositoryImage, RepositoryImageProps } from './images/repository';
