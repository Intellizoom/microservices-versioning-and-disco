# Microservice Discovery and Versioning

A common problem in microservice design is ensuring services can dynamically find and connect to the services they depend on.  The difficult of Service Discovery is compounded as services mature and API interfaces change, making newer versions of downsteam services incompatible with those that rely on them.

Picking a strategy that works is essential.  Microservice versioning and discovery are interconnected topics with implementation strategies that pervade the development and deployment process.  The consequences of implementing the wrong strategy can have a huge impact on the productivity of your team, as well as, the reliability of deployments and operability of the system.  In fact, I would argue that this is probably one of the most difficult topics in microservice design and a likely cause of failure in organizational efforts to migrate to the microservice pattern.

If you are in the process of building a microservice architecture, you probably have researched this topic and discovered there is almost no consensus on how this should be implemented.  In fact, over the last couple of years I found little to no information that holistically discusses this topic (in books and blog posts).  After some research and contemplation, I decided it would be important to document some of the practices, as well as, note some conclusions I've made of the different approaches.

I would also like to hear your thoughts on Microservice versioning and service discovery, particularly if you have other approaches not defined in this document.  Just send me a note on Twitter at [@richardclayton](https://twitter.com/richardclayton).

## Patterns of Service Discovery and Versioning

There are three general patterns for ensuring a service communicates with a compatible downstream service.  The patterns are differentiated by the component responsible for versioning and/or discovery:

* **API Versioning** - services handle versioning at the API/interface level.
* **Service Versioning** - discovery is handled by a registry with versioning at the service level.
* **Mesh/Dynamic Routing** - discovery and versioning are external of the service (i.e. service is unaware).

Each pattern has it's strengths and weaknesses, some of which have less to do with technology and more with the internal structure of your engineering organization.  The next sections will describe each pattern in detail and provide recommendations on the circumstances where they are best employed.

### API Versioning

### Service Versioning

A natural answer to this problem is to implement "versioning" within services.  This usually involves tagging a service with a special numeric sequence.  In Node.js, this sequence is SemVer (Semantic Versioning) consisting of three numbers: major build version, minor build version, and a patch version (e.g. 1.2.3).

In this deployment pattern, microservices will typically specify a set of external dependencies on other microservices in the environment.  This usually follows the same pattern as the importing of software dependencies (a manifest of required services at specific versions).

When implemented, the pattern often involves the microservice executing a query against a service registry, retrieving the addresses and port assignments of services matching a version requirement.  In sophisticated implementations these requirements are defined using a pattern matching convention used by the Node Package Manager (NPM).  Services can specify a range of versions for a dependency using special wildcards and prefixes.  For instance, the use of `>=` to prefix a version (e.g. `>=1.2.0`) means "any version greater than or equal to the one specified".

Let's consider a quick example.  Imagine a Payment Service makes calls to a Customer Service to retrieve the account information of a customer before executing a payment.  The Payment Service would query the service registry for a list of Customer Services that matched a specific version requirement (say `>=3.2.0`).  The registry may contain many versions of the Customer Service, but given the requirements of Payment Service, returns only the latest version (greater than or equal to `3.2.0`).

This is the common pattern used for service discovery with versioning requirements.  [Netflix has experimented with this approach in the past](https://medium.com/the-node-js-collection/netflixandchill-how-netflix-scales-with-node-js-and-containers-cf63c0b92e57#.s0zvz45uk), though it's not clear if they are still using the pattern.  We were considering this approach with our microservice infrastructure at Intellizoom

Reading the 

### Mesh/Dynamic Routing


### Modifying/Combining Patterns

It is important to note that there is room for variation in these patterns.  For instance, it is possible to use a hybrid of these patterns, like using API Versioning and Mesh/Dynamic Routing together.  While it may make sense for an organization to adopt a hybrid (what do I know about your use cases?), it is easy to argue that purity in implementation pattern is preferable.  Why version an internal API, but then dynamically link a service to it's downsteam dependencies?  In this example, we've doubled the complexity of versioning making it more effort to version and prone to error.

However, I admit that there are use cases where this makes sense.  Did you notice in the example that API was prefaced with "internal"?  That's because it absolutely makes sense to version an API for external clients.  That does not mean you have to use API versioning throughout the architecture (i.e. for the internal APIs).  You can instead employ a Gateway that either transforms requests to a newer API version or performs a look up against a service registry for a matching service version.  There are probably other approaches, but the point is that your internal and external versioning implementations don't have to be the same.



This is an example project demonstrating how to create a versioned microservice environment without having to make services version-aware.

```
/srv=>/#/consul/development;
/host/foobar=> /srv/foobar-v2;
/host=>/srv;
/svc=>/host;
/http/1.1/*=>/host;
```