
import { APIGatewayEvent, APIGatewayProxyResultV2, Context } from 'aws-lambda';

import { APIBaseInteraction, APIChatInputApplicationCommandInteractionData, APIInteractionResponse, InteractionResponseType, InteractionType } from 'discord-api-types/v10';
import { verify } from '@layer/discord-authorizer';
import { logger, metrics, tracer } from '@layer/powertools';
import type { Subsegment } from 'aws-xray-sdk-core';

export const handler = async (event: APIGatewayEvent, context: Context): Promise<APIGatewayProxyResultV2<APIInteractionResponse>> => {
  if (!event.body) {
    logger.error(`Empty request body`);
    return {
      statusCode: 400,
      body: JSON.stringify({ errorMessage: "invalid empty body" })
    };
  }
  // Tracer: Get facade segment created by AWS Lambda
  const segment = tracer.getSegment();
  // Tracer: Create subsegment for the function & set it as active
  let handlerSegment: Subsegment | undefined;
  if (segment) {
    handlerSegment = segment.addNewSubsegment(`## ${process.env._HANDLER}`);
    tracer.setSegment(handlerSegment);
  }
  // Tracer: Annotate the subsegment with the cold start & serviceName
  tracer.annotateColdStart();
  tracer.addServiceNameAnnotation();

  // Tracer: Add awsRequestId as annotation
  tracer.putAnnotation('awsRequestId', context.awsRequestId);

  // Metrics: Capture cold start metrics
  metrics.captureColdStartMetric();

  // Logger: Append awsRequestId to each log statement
  logger.appendKeys({
    awsRequestId: context.awsRequestId,
  });
  if (!await verify(event)) {
    return {
      statusCode: 401,
      body: JSON.stringify({ errorMessage: "invalid signature" })
    };
  }
  logger.info('Valid signature')
  const { type, data }: APIBaseInteraction<InteractionType, APIChatInputApplicationCommandInteractionData> = JSON.parse(event.body);

  if ((type === InteractionType.ApplicationCommand || type === InteractionType.ApplicationCommandAutocomplete) && !data) {
    return {
      statusCode: 400,
      body: JSON.stringify({ errorMessage: 'Empty data' })
    };
  }
  if (type === InteractionType.Ping)
    return {
      statusCode: 200,
      body: JSON.stringify({ type: InteractionResponseType.Pong })
    };

  return {
    statusCode: 400,
    body: JSON.stringify({
      type: InteractionResponseType.ChannelMessageWithSource,
      content: `Unknown command ${type}`
    })
  };

}