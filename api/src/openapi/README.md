# OpenAPI and JSON-Schema

## Whats the difference between [OpenAPI](https://swagger.io/specification/) and [JSON-Schema](https://json-schema.org/)?

OpenAPI and JSON-SChema are identical in many ways, but in general:

### OpenAPI

OpenAPI is designed to define an entire API

- server urls
- server meta information
- routes/paths
- requests
- responses
- etc

### JSON-Schema

JSON-Schema is designed to define a JSON object

- any use case where an object must conform to a known template.

### Additional Reading

For a detailed breakdown of the ven-diagram like relationship these 2 schemas have, see: https://swagger.io/docs/specification/data-models/keywords/

## How are OpenAPI and JSON-Schema being used in this API?

### OpenAPI

The entire API is defined using the OpenAPI specification.

- This includes the specification of the endpoints, including their required parameters and any additional details that describe the endpoint.

### JSON-Schema

Request and response bodies are described with JSON-Schema inside the OpenAPI definitions. `express-openapi` uses these schemas to validate incoming requests before they reach the route handlers.
