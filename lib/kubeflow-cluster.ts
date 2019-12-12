import iam = require('@aws-cdk/aws-iam');
import eks = require('@aws-cdk/aws-eks');
import cfn = require('@aws-cdk/aws-cloudformation');
import lambda = require('@aws-cdk/aws-lambda');
import s3 = require('@aws-cdk/aws-s3');

import path = require('path');

import cdk = require('@aws-cdk/core');
import { Duration, Stack } from '@aws-cdk/core';
import { Bucket } from '@aws-cdk/aws-s3';

export interface KubeflowClusterProps {

  readonly cluster: eks.Cluster;

  readonly layers: lambda.ILayerVersion[];

  readonly bucket: string;

  readonly configUrl?: string;

  readonly adminRole: iam.IRole;
}

export class KubeflowCluster extends cdk.Construct {
  constructor(scope: cdk.Construct, id: string, props: KubeflowClusterProps) {
    super(scope, id);

    if (props.cluster.defaultCapacity == undefined) {
      throw new Error("Autoscaling group must have at least one instance defined");
    } 

    const func = new lambda.Function(this, 'KfClusterFunction', {
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambda/kubeflow-cluster-resource')),
      runtime: lambda.Runtime.PROVIDED,
      handler: 'main',
      timeout: Duration.minutes(15),
      layers: props.layers,
      memorySize: 512,
      environment: {
        region: Stack.of(this).region,
      }
    });

    func.addToRolePolicy(new iam.PolicyStatement({
      actions: [ 'eks:CreateCluster', 'eks:DescribeCluster', 'eks:DeleteCluster', 'eks:UpdateClusterVersion' ],
      resources: [ '*' ]
    }));

    func.addToRolePolicy(new iam.PolicyStatement({
      actions: [ 's3:PutObject', 's3:GetObject', 's3:DeleteObject' ],
      resources: [ `arn:aws:s3:::${props.bucket}/${props.cluster.clusterName}/*` ]
    }));    

    func.addToRolePolicy(new iam.PolicyStatement({
      actions: [ 'iam:PutRolePolicy' ],
      resources: [ props.cluster.defaultCapacity.role.roleArn ]
    }));    

    func.addToRolePolicy(new iam.PolicyStatement({
      actions: [ 'sts:AssumeRole' ],
      resources: [ props.adminRole.roleArn ]
    }));  

    // the CreateCluster API will allow the cluster to assume this role, so we
    // need to allow the lambda execution role to pass it.
    func.addToRolePolicy(new iam.PolicyStatement({
      actions: [ 'iam:PassRole' ],
      resources: [ props.cluster.role.roleArn ]
    }));

    new cfn.CustomResource(this, 'KfClusterCustomResource', { 
      provider: cfn.CustomResourceProvider.fromLambda(func),
      resourceType: "Custom::KubeflowCluster",
      properties: {
        clusterName: props.cluster.clusterName,
        ...(props.configUrl) ? { kubeflowConfigUrl: props.configUrl } : {},
        kubeflowStagingS3Bucket: props.bucket,
        instanceIamRoleArn: props.cluster.defaultCapacity.role.roleArn,
        adminIamRoleArn: props.adminRole.roleArn,
      }    
    });
  }
}
