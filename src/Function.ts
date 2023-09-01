import { Duration, RemovalPolicy, Stack } from "aws-cdk-lib";
import { Effect, IRole, PolicyStatement, Role, ServicePrincipal } from "aws-cdk-lib/aws-iam";
import { Architecture, ILayerVersion, LayerVersion, Runtime, Tracing } from "aws-cdk-lib/aws-lambda";
import { NodejsFunction, NodejsFunctionProps, OutputFormat } from "aws-cdk-lib/aws-lambda-nodejs";
import { LogGroup, RetentionDays } from "aws-cdk-lib/aws-logs";
import { IStringParameter, StringParameter } from "aws-cdk-lib/aws-ssm";
import { Construct } from "constructs";

const PARAM_PREFIX = 'fn-';
export interface NodetsFunctionProps extends NodejsFunctionProps {
    policies?: PolicyStatement[]
    parameters?: string[]
    powertools?: boolean
}
export const commonProps: Partial<NodejsFunctionProps> = {
    architecture: Architecture.ARM_64,
    runtime: Runtime.NODEJS_18_X,
    memorySize: 128,
    tracing: Tracing.ACTIVE,
    handler: 'index.handler',
    timeout: Duration.seconds(30),
    retryAttempts: 0,
    environment: {
        NODE_OPTIONS: '--enable-source-maps'
    },
    bundling: {
        minify: process.env.NODE_ENV === 'production',
        banner: 'import { createRequire } from \'module\'; const require = createRequire(import.meta.url);',
        mainFields: ['module', 'main'],
        target: 'node18',
        externalModules: ['@aws-sdk/*', 'aws-lambda', '@layer/*', '@aws-lambda-powertools/*', 'aws-xray-sdk-core'],
        format: OutputFormat.ESM
    },
    layers: [],
};


export class NodetsFunction extends Construct {
    declare role: Role
    declare logRetentionRole: IRole

    declare lambda: NodejsFunction
    declare parameters: { [name: string]: IStringParameter }
    declare logGroup: LogGroup
    declare powertools: ILayerVersion

    constructor(scope: Construct, id: string, { policies, powertools: enablePowerTools, ...props }: NodetsFunctionProps) {
        super(scope, id);
        if (enablePowerTools !== false) {
            this.powertools = LayerVersion.fromLayerVersionArn(scope, `layer-powertool-${id}`, `arn:aws:lambda:${Stack.of(this).region}:094274105915:layer:AWSLambdaPowertoolsTypeScript:18`);
            commonProps.layers?.push(this.powertools);
        }

        // create a log group to prevent log retention role creation
        this.logGroup = new LogGroup(this, `fn-log-${id}`, {
            logGroupName: `/aws/lambda/${id}`,
            removalPolicy: RemovalPolicy.DESTROY,
            retention: RetentionDays.ONE_DAY
        });

        this.role = new Role(scope, `fn-role-${id}`, {
            roleName: `fnRole${id}`,
            assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
            description: `lambda exec role for ${id}`,
        });
        if (policies) {
            const r = this.role;
            policies.forEach(e => r.addToPolicy(e));
        }
        this.parameters = {};
        props.parameters?.forEach(nameParam => {
            const p = StringParameter.fromStringParameterName(this, `fn-param-${id}-${nameParam}`, `${PARAM_PREFIX}${nameParam}`);
            p.grantRead(this.role);
            this.parameters[nameParam] = p;

        });
        this.role.addToPrincipalPolicy(new PolicyStatement(
            {
                effect: Effect.ALLOW,
                actions: [
                    "logs:CreateLogStream",
                    "logs:PutLogEvents",
                ],
                resources: [`${this.logGroup.logGroupArn}:*`],
            }
        ));

        if (props.vpc) {
            this.role.addToPrincipalPolicy(new PolicyStatement({
                effect: Effect.ALLOW,
                actions: [
                    "ec2:CreateNetworkInterface",
                    "ec2:DescribeNetworkInterfaces",
                    "ec2:DeleteNetworkInterface",
                    "ec2:AssignPrivateIpAddresses",
                    "ec2:UnassignPrivateIpAddresses"
                ],
                resources: ["*"] // todo be restrictive on VPC access
            }));
        }
        //default tracing is active
        if (!props.tracing || props.tracing === Tracing.ACTIVE)
            this.role.addToPrincipalPolicy(new PolicyStatement(
                {
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
                    resources: [`${this.logGroup.logGroupArn}:*`],
                }
            ))

        const paramEnvs: { [name: string]: string } = {}
        Object.keys(this.parameters).forEach(paramName => {
            paramEnvs[`PARAM_${paramName.toUpperCase().replaceAll('-', '_')}`] = this.parameters[paramName].stringValue
        })


        this.lambda = new NodejsFunction(scope, `fn-${id}`, {
            //default values
            ...commonProps,
            entry: `src/functions/${id}/index.ts`,
            ...props,

            // force the name, do not let the cdk generate one
            functionName: props.functionName || id,
            // force a role, do not let the cdk generate one, important to avoid issues when using grant*
            role: this.role,
            layers: props.layers ? [...commonProps.layers ?? [], ...props.layers] : commonProps.layers,
            //force the flag to not add the default permissive policy
            tracing: Tracing.DISABLED,
            // override props
            bundling: {
                ...commonProps.bundling,
                ...props.bundling,
            },
            environment: {
                ...commonProps.environment,
                ...paramEnvs,
                ...props.environment
            },
        });

    }

}
