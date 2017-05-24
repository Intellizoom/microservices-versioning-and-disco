const program = require('commander');
const consul = require('consul')();
const request = require('request');

program.version('1.0.0');

program
  .command('demote')
  .alias('setup')
  .description('restore older version, demote newer to staging.')
  .action(() => {
    consul.kv.set('namerd/dtabs/example', `
      /srv=>/#/consul/development;
      /host/foobar=> /srv/foobar-v1;
      /host/www.foobar => /srv/foobar-v1;
      /host/staging.foobar => /srv/foobar-v2;
      /host=>/srv;
      /svc=>/host;
      /http/1.1/*=>/host;
    `, (err) => {
      if (err) {
        return console.error(err);
      }
      return console.log('DTab written to Consul');
    });
  });

program
  .command('promote')
  .description('promote newer version to production.')
  .action(() => {
    consul.kv.set('namerd/dtabs/example', `
      /srv=>/#/consul/development;
      /host/foobar=> /srv/foobar-v2;
      /host/www.foobar => /srv/foobar-v2;
      /host/staging.foobar => /srv/foobar-v2;
      /host/retired.foobar => /srv/foobar-v1;
      /host=>/srv;
      /svc=>/host;
      /http/1.1/*=>/host;
    `, (err) => {
      if (err) {
        return console.error(err);
      }
      return console.log('DTab written to Consul');
    });
  });

program
  .command('call [env]')
  .description('request foobar from specific environment')
  .action((env) => {
    const environment = env || 'www';
    request({
      method: 'GET',
      // You could set a /etc/hosts entry for the
      // server and avoid the host header:
      // http://${environment}.gateway:3000/api/foobar
      url: 'http://localhost:3000/api/foobar',
      headers: {
        Host: `${environment}.gateway`,
      },
    }, (err, response, body) => {
      if (err) {
        return console.error(err);
      }
      if (response.statusCode > 299) {
        return console.log([response.statusCode], body);
      }
      return console.log('RESPONSE:', body);
    });
  });

program.parse(process.argv);