const Promise = require('bluebird');
const fs = require('fs');
const Docker = require('dockerode');
const program = require('commander');
const { ok: assert } = require('assert');
const os = require('os');

Promise.promisifyAll(fs);

program
  .version('1.0.0')
  .option('-w', '--watch <file>', 'File to watch')
  .option('-r', '--reload <container>', 'ECS Container to reload')
  .option('-t', '--wait [timems]', 'Wait a number of milliseconds; default 5000ms')
  .option('-d', '--docker [socket]', 'Path to the Docker socket, default /tmp/docker.sock')
  .parse(process.argv);

const waitTime = program.wait || 5000;
const hostname = os.hostname();
const dockerSocket = program.docker || '/tmp/docker.sock';

const assertFileExists = (file) => {
  
};

try { 

  assert(
    (await fs.fstat(program.docker)).isSocket(),
    `Docker socket ${program.docker} was not found or is not a socket`
  );

  const docker = new Docker({ socketPath: dockerSocket });

  

  await Promise.delay(waitTime);

  assert(
    (await fs.fstat(program.watch)).isFile(),
    `File to watch ${program.watch} was not found or is not a file`
  );

  fs.watch(promise.watch, (err) => {
    if (err) {
      return console.error(err);
    }
    const 
  });

} catch (error) {
  console.error(error);
  process.exit(1);
}
