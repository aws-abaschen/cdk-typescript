import { CfnResource, IAspect, RemovalPolicy, Resource, TagManager } from "aws-cdk-lib";
import { IConstruct } from "constructs";

interface ResourceAspectProps {
    removalPolicy: RemovalPolicy
    // add whatever tag to every resource 
    [name: string]: string
}

export class ResourceAspect implements IAspect {
    readonly tags: { [key: string]: string; }
    readonly iter: string[]
    readonly removalPolicy: RemovalPolicy

    constructor({ removalPolicy, ...props }: ResourceAspectProps) {
        this.tags = { ...props };
        this.iter = Object.keys(this.tags);
        this.removalPolicy = removalPolicy;
    }

    visit(node: IConstruct) {
        //console.log(node.node.id);
        if (CfnResource.isCfnResource(node) || (node instanceof Resource && node.node.defaultChild)) {
            try {
                // apply destroy to everything
                node.applyRemovalPolicy(this.removalPolicy);
            } catch (error) {
                console.warn('cannot apply RemovalPolicy to ' + node.constructor.name + '/' + node.node.id);
            }
        }

        if (TagManager.isTaggable(node) && CfnResource.isCfnResource(node)) {
            node.tags.setTag('resource:type', node.cfnResourceType);
            //console.log("....."+node.cfnResourceType);
            this.iter.forEach(k => node.tags.setTag(`x-${k}`, this.tags[k]))
        }

    }
}