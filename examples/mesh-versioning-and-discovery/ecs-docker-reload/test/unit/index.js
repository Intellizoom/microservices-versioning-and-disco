const Promise = require('bluebird');
const { describe, it } = require('mocha');
const chai = require('chai');
const { AssertionError } = require('assert');
const { stub } = require('sinon');
const os = require('os');
const fs = require('fs');
const { resolve } = require('path');

const { expect } = chai;

chai.use(require('chai-as-promised'));
chai.use(require('sinon-chai'));

const {
  getConfiguration,
  getDockerInstance,
  getLabel,
  getTargetContainer,
  getTaskContainers,
  getTaskArn,
  run,
  signalOnFileChange,
  constants: {
    ECS_CONTAINER_NAME_KEY,
    ECS_TASK_ARN_KEY,
  },
} = require('../../index.js');

describe('ECS Docker Reload', () => {
  const exampleTaskArn = 'arn:aws:ecs:us-east-1:123456789012:task/00084709-991b-44ae-b5a6-a5cb47f914da';

  describe('Get Configuration', () => {
    it('should terminate if --reload is not specified', () => {
      expect(() => getConfiguration(['node', 'index.js', '--watch', '/foo/bar']))
        .to.throw(AssertionError);
    });

    it('should terminate if --watch is not specified', () => {
      expect(() => getConfiguration(['node', 'index.js', '--reload', 'haproxy']))
        .to.throw(AssertionError);
    });

    it('should parse values submitted to the process', () => {
      const params = ['node', 'index.js', '-w', '/tmp/watchme', '-r', 'foo-bar', '-t', '6000', '-d', '/tmp/docker.sock'];
 
      expect(getConfiguration(params))
        .to.deep.eq({
          waitTime: 6000,
          hostname: os.hostname(),
          dockerSocket: '/tmp/docker.sock',
          reload: 'foo-bar',
          fileToWatch: '/tmp/watchme',
        });
    });

    it('should provide sensible defaults', () => {
      const params = ['node', 'index.js', '-w', '/tmp/watchme', '-r', 'foo-bar'];
 
      expect(getConfiguration(params))
        .to.deep.eq({
          waitTime: 5000,
          hostname: os.hostname(),
          dockerSocket: '/var/run/docker.sock',
          reload: 'foo-bar',
          fileToWatch: '/tmp/watchme',
        });
    });
  });

  describe('Get Docker Instance', () => {
    it('should throw an error if the Docker socket is not a socket', () => {
      expect(() => getDockerInstance(resolve(__dirname, './not-a-socket')))
        .to.throw(AssertionError);
    });
  });

  describe('Get Label', () => {
    it('should return the specified label from the container.Config.Labels object', () => {
      const container = {
        Config: {
          Labels: {
            [ECS_TASK_ARN_KEY]: 'arn:aws:ecs:us-east-1:123456789012:task/00084709-991b-44ae-b5a6-a5cb47f914da',
          },
        },
      };
      expect(getLabel(container, ECS_TASK_ARN_KEY))
        .to.eq(container.Config.Labels[ECS_TASK_ARN_KEY]);
    });

    it('should return the specified label from the container.Label object if not on container.Config.Labels object', () => {
      const container = {
        Labels: {
          [ECS_TASK_ARN_KEY]: 'arn:aws:ecs:us-east-1:123456789012:task/00084709-991b-44ae-b5a6-a5cb47f914da',
        },
      };
      expect(getLabel(container, ECS_TASK_ARN_KEY))
        .to.eq(container.Labels[ECS_TASK_ARN_KEY]);
    });

    it('should return nothing if the key is not found', () => {
      const container = { Labels: {} };
      expect(getLabel(container, ECS_TASK_ARN_KEY))
        .to.be.undefined;
    });
  });

  describe('Get Target Container', () => {
    it('should reject if Task Arn cannot be found', () => {
      const docker = {
        getContainer: stub(),
      };
      docker.getContainer.rejects();
      return expect(getTargetContainer(docker, 'foo-bar', 'hello-world')).to.be.rejected;
    });

    it('should reject if Task Containers cannot be found', () => {
      const docker = {
        getContainer: stub(),
        listContainers: stub(),
      };
      const container = { inspect: stub() };
      docker.getContainer.returns(container);
      container.inspect.resolves({
        Config: {
          Labels: {
            [ECS_TASK_ARN_KEY]: exampleTaskArn,
          },
        },
      });
      docker.listContainers.resolves([]);
      return expect(getTargetContainer(docker, 'abcd1234acbd', 'foo-bar')).to.be.rejected;
    });

    it('should reject if Target Container cannot be found', () => {
      const docker = {
        getContainer: stub(),
        listContainers: stub(),
      };
      const container = { inspect: stub() };
      docker.getContainer.returns(container);
      container.inspect.resolves({
        Config: {
          Labels: {
            [ECS_TASK_ARN_KEY]: exampleTaskArn,
          },
        },
      });
      docker.listContainers.resolves([{
        Labels: {
          [ECS_CONTAINER_NAME_KEY]: 'edr',
        },
      }, {
        Labels: {
          [ECS_CONTAINER_NAME_KEY]: 'hello-world',
        },
      }]);
      return expect(getTargetContainer(docker, 'abcd1234acbd', 'foo-bar')).to.be.rejected;
    });

    it('should resolve the Target Container', () => {
      const docker = {
        getContainer: stub(),
        listContainers: stub(),
      };
      const container = { inspect: stub() };
      docker.getContainer.returns(container);
      container.inspect.resolves({
        Config: {
          Labels: {
            [ECS_TASK_ARN_KEY]: exampleTaskArn,
          },
        },
      });
      docker.listContainers.resolves([{
        Id: 'a786fa987ds6f7896asd87f6a78sd68a7sdf68sad7f',
        Labels: {
          [ECS_CONTAINER_NAME_KEY]: 'edr',
        },
      }, {
        Id: '34h89asd76a8s7df7687asd6f78as6df87a6s8asdf6',
        Labels: {
          [ECS_CONTAINER_NAME_KEY]: 'foo-bar',
        },
      }]);
      return expect(getTargetContainer(docker, 'abcd1234acbd', 'foo-bar'))
        .to.eventually.be.an.instanceOf(Object);
    });
  });

  describe('Get Task Containers', () => {
    it('should reject if containers cannot be listed', () => {
      const docker = {
        listContainers: stub(),
      };
      docker.listContainers.rejects();
      return expect(getTaskContainers(docker, 'foo-bar')).to.be.rejected;
    });

    it('should reject if more than one container cannot be found for the Task ARN', () => {
      const docker = {
        listContainers: stub(),
      };
      docker.listContainers.resolves([{}]);
      return expect(getTaskContainers(docker, 'foo-bar')).to.be.rejected;
    });

    it('should return the task containers', () => {
      const docker = {
        listContainers: stub(),
      };
      docker.listContainers.resolves([{}, {}]);
      return expect(getTaskContainers(docker, 'foo-bar')).to.eventually.deep.eq([{}, {}]);
    });
  });

  describe('Get Task ARN', () => {
    it('should throw an error if it cannot retrieve the current container', () => {
      const docker = { getContainer: stub() };
      docker.getContainer.returns(null);
      return expect(getTaskArn(docker, 'foobar')).to.be.rejected;
    });

    it('should throw an error if it cannot inspect the current container', () => {
      const docker = { getContainer: stub() };
      const container = { inspect: stub() };
      docker.getContainer.returns(container);
      container.inspect.rejects();
      return expect(getTaskArn(docker, 'foobar')).to.be.rejected;
    });

    it('should throw an error if it cannot find the Task ARN', () => {
      const docker = { getContainer: stub() };
      const container = { inspect: stub() };
      docker.getContainer.returns(container);
      container.inspect.resolves({ Config: { Labels: {} } });
      return expect(getTaskArn(docker, 'foobar')).to.be.rejected;
    });

    it('should return the Task ARN for the current container', () => {
      const docker = { getContainer: stub() };
      const container = { inspect: stub() };
      docker.getContainer.returns(container);
      container.inspect.resolves({
        Config: {
          Labels: {
            [ECS_TASK_ARN_KEY]: 'foo-bar',
          },
        },
      });
      return expect(getTaskArn(docker, 'foobar')).to.eventually.eq('foo-bar');
    });
  });

  describe('Run', () => {

  });

  describe('Signal on File Change', () => {
    it('should throw an error if the file does not exist', () => {
      return expect(signalOnFileChange({}, '/should/not/exist'))
        .to.be.rejected;
    });

    describe('File Watcher', () => {
      let watcher;
      const fileToWatch = resolve(__dirname, './watchme');
      
      beforeEach(() => {
        fs.writeFileSync(fileToWatch, 'foobar\n');
      });

      afterEach(() => {
        if (watcher) {
          watcher.close();
        }
        fs.unlinkSync(fileToWatch);
      });

      it('should watch the file and send the SIGHUP signal on change', async () => {
        const target = {
          kill: stub(),
        };
        target.kill.resolves();
        watcher = await signalOnFileChange(target, fileToWatch);
        fs.writeFileSync(fileToWatch, 'foobar\n');
        // Give the FS.Watch 50ms to react to the event (probably next event loop, but who knows?).
        await Promise.delay(50);
        expect(target.kill).to.be.calledWith({ signal: 'SIGHUP' });
      });
    });
  });
});
