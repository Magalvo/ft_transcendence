export const sendSuccess = (reply, data, statusCode = 200) => {
    reply.status(statusCode).send({ success: true, data, error: null });
};
export const sendError = (reply, message, statusCode = 400) => {
    reply.status(statusCode).send({ success: false, data: null, error: message });
};
