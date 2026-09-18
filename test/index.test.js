'use strict'

const { handler } = require('../src/index');

describe('hello function', () => {
  it('should return statusCode 200 and a greeting message', async () => {
    const response = await handler({});
    expect(response.statusCode).toBe(200);

    const body = JSON.parse(response.body);
    expect(body).toHaveProperty('message', 'Hello from Serverless!');
  });
});
