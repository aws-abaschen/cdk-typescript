export const iam = {
    getResourceTagPolicyCondition(tagName: string, tagValue: string) {
        return {
            "StringEquals": {
                [`aws:ResourceTag/${tagName}`]: tagValue
            }
        };
    }
}