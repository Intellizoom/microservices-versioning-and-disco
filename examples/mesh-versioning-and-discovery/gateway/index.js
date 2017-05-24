const Hapi = require('hapi');
const Boom = require('boom');
const Request = require('request');
const { waterfall } = require('async');

const server = new Hapi.Server();

server.connection({ port: 3000, host: '0.0.0.0' });

const MESH_HTTP_ADDRESS = `http://${process.env.LINKERD_IP}:${process.env.LINKERD_HTTPPORT}`;

/**
 * Extracts the choosen environment from the request.
 */
server.method({
  name: 'env.get',
  method(hostHeader, callback) {
    const segments = hostHeader.split('.');
    if (segments.length > 1) {
      return callback(null, segments[0]);
    }
    // Default to production
    return callback(null, 'www');
  }
});

/**
 * Execute a Web Request against a downstream microservice.
 */
server.method({
  name: 'request.execute',
  method(request, options, callback) {
    waterfall([
      next => request.server.methods.env.get(request.headers.host, next),
      (env, next) => {
        const host = `${env}.${options.service}`;
        request.log(['debug'], {
          message: `Making request to ${host}.`,
        });
        next(null, host);
      },
      (Host, next) => Request(Object.assign({}, options, {
        service: undefined,
        path: undefined,
        url: `${MESH_HTTP_ADDRESS}${options.path}`,
        headers: { Host },
      }), next),
    ], callback);
  }
});

server.route({
  method: 'GET',
  path: '/api/foobar',
  handler(request, reply) {
    request.log(['info'], { message: 'Making delegated request to foobar service' });
    request
      .server
      .methods
      .request
      .execute(request, {
        method: 'GET',
        service: 'foobar',
        path: '/index.html',
      }, (error, response, body) => {
        if (error) {
          request.log(['error'], {
            message: 'Error occurred requesting data from downstream service.',
            error,
          });
          return reply(Boom.badImplementation('Something went wrong'));
        }
        if (response.statusCode > 299) {
          return reply(Boom.wrap(new Error(body), response.statusCode));
        }
        return reply(body);
      });
  },
});

const options = {
  ops: {
    interval: 1000
  },
  reporters: {
    consoleReporter: [{
        module: 'good-squeeze',
        name: 'Squeeze',
        args: [{ request: '*', log: '*', response: '*' }]
    }, {
        module: 'good-console'
    }, 'stdout'],
  },
};

server.register({
  register: require('good'),
  options,
}, (err) => {
  if (err) return console.error(err);
  server.start((err) => {
    if (err) throw err;
    server.log(['info'], `Server running at: ${server.info.uri}`);
    server.log(['info'], `Service mesh available at: ${MESH_HTTP_ADDRESS}`);
  });
});
