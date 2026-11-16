import handler from '../backend/src/serverless';

export default handler;

export const config = {
  api: {
    bodyParser: false, // Let NestJS / Express handle multipart & request bodies
  },
};
