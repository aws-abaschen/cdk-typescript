# aws-cdk-node-ts-boilerplate
A boilerplate to work with AWS CDK and Typescript with ESM modules


## NodetsFunction

This construct will allow your lambdas to output `.mjs` files with their source maps. It relies on standardized folder structure in `src/`
Each Lambda function will have to be written in a folder which will become its `functionName` in `src/functions/{functionName}/index.ts`.

*All the default values are for example purpose and doesn't reflect any recommendation nor will be maintained.*

### IAM Role and Policies
Instead of letting CDK generating a role, the construct will create one named `fnRole${id}` and will append the policies below with a Stack id `fn-role-${id}`. The property `role` is also available for further manipulation.

#### 1. Logging
By default, the PolicyStatement to write in the log group will be added:
```typescript
new PolicyStatement(
    {
        effect: Effect.ALLOW,
        actions: [
            "logs:CreateLogGroup",
            "logs:CreateLogStream",
            "logs:PutLogEvents",
        ],
        resources: [`arn:aws:logs:${Stack.of(this).region}:${scope.account}:log-group:/aws/lambda/${id}:*`]
    }
);
```

#### 2. VPC
Adding a VPC to your lambda function will automatically add the policy to connect: 
```typescript
new PolicyStatement({
    effect: Effect.ALLOW,
    actions: [
        "ec2:CreateNetworkInterface",
        "ec2:DescribeNetworkInterfaces",
        "ec2:DeleteNetworkInterface",
        "ec2:AssignPrivateIpAddresses",
        "ec2:UnassignPrivateIpAddresses"
    ],
    resources: ["*"]
});
```

#### 3. Tracing
Tracing is enabled by default and the policy statement will be added unless disabled: 

```typescript
new PolicyStatement({
        effect: Effect.ALLOW,
        actions: [
            "logs:CreateLogDelivery",
            "logs:DeleteLogDelivery",
            "logs:DescribeLogGroups",
            "logs:DescribeResourcePolicies",
            "logs:GetLogDelivery",
            "logs:ListLogDeliveries",
            "logs:PutResourcePolicy",
            "logs:UpdateLogDelivery",
            "xray:GetSamplingRules",
            "xray:GetSamplingTargets",
            "xray:PutTelemetryRecords",
            "xray:PutTraceSegments"
        ],
        resources: [`arn:aws:logs:${Stack.of(this).region}:${scope.account}:log-group:/aws/lambda/${id}:*`],
})
```

### SSM String parameters

String parameters can be automatically referenced and read policy applied if they follow a specific prefix (default here is `fn-`). They will then get injected as an environment variable with `PARAM_` prefix and `-` (dash) replaced with `_` (underscore) in the name:
```typescript
new NodetsFunction(this, name, {
    parameters: ['DB-USER'],
    environment: {
        TEST_1: 'test Value 1'
    }
});
```

Will output: 
```yaml
[...]
      Environment:
        Variables:
          NODE_OPTIONS: --enable-source-maps
          PARAM_DB_USER:
            Ref: discordpongfnparamDBUSERParameter70CB30BD
          TEST_1: test Value 1
          AWS_NODEJS_CONNECTION_REUSE_ENABLED: "1"
[...]
Parameters:
  discordpongfnparamDBUSERParameter70CB30BD:
    Type: AWS::SSM::Parameter::Value<String>
    Default: fn-DB-USER
```

## NodetsLayer

Similarly, a layer will be named and the source has to be in a folder `layerName` in `src/layers/{layerName}/index.ts`.
Then a layer has to be referenced with `import { someExport } from '@layer/layerName'`. The aliasing for typescript is in [tsconfig.json](tsconfig.json) `$.aliases` and `$.compilerOptions.paths`.

Example in [Discord authorizer layer](src/layers/discord-authorizer/index.ts):
```typescript
export const verify = async (event: APIGatewayEvent): Promise<Boolean> => {
    ...
}
```

Can be referenced in [the lambda function discrod-pong](src/functions/discord-pong/index.ts):
```typescript
import { verify } from '@layer/discord-authorizer';
```

*Explanations:
During layer build, the layer is compiled into a module with a `package.json` file. At runtime this module will end up in the lambda filesystem inside the `/nodejs/node_modules/@layer\/discord-authorizer`. Thus when referencing '@layer/discord-authorizer` it will automatically find it.*

## Autotagging

The `ResourceAspect` will tag every Cloud Formation resource with whatever static tag given in the props:

```typescript
const fn = new NodetsFunction(this, 'fn', {...});
Aspects.of(fn).add(new ResourceAspect({
  app: 'SampleApp'
}));
```

Will result in the template:
```yaml

  fnreturn2005A3631C2:
    Type: AWS::Lambda::Function    
    Properties:
      # ...
      Tags:
        - Key: resource:type
          Value: AWS::Lambda::Function
        - Key: x-app
          Value: SampleApp
```

Any static tag is prefixed with `x-`. The aspect can also be applied to the `App` or `Stack` directly for recursive tagging. Some resource may be missed like the lambda for log retention in a lambda function.
