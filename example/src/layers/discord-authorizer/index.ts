import { APIGatewayEvent } from 'aws-lambda';

import { Buffer } from 'node:buffer';
import { sign } from "tweetnacl";

if (!process.env.APP_PUBLIC_KEY) {
    process.exit(1);
}

var publicKeyBuffer = Buffer.from(process.env.APP_PUBLIC_KEY, "hex");
export const verify = async (event: APIGatewayEvent): Promise<Boolean> => {
    const checksum = {
        sig: event.headers["x-signature-ed25519"],
        timestamp: event.headers["x-signature-timestamp"]
    };
    if (!event.body || !checksum.timestamp || !checksum.sig) {
        return false;
    }
    let isVerified = false;

    try {
        return sign.detached.verify(
            Buffer.from(checksum.timestamp + event.body),
            Buffer.from(checksum.sig, "hex"),
            publicKeyBuffer
        );
    } catch (e) {
        console.log(e);
        isVerified = false
    }

    return false;
}