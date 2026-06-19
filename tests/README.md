# Tests

Docker-based Cypress tests for the **csp-editor** module.

## What is under test

`csp-editor` registers a `CspPolicyEditor` selectorType and binds it (via the
`jahia-content-editor-forms` fieldsets) to the `policy` field of two mixins provided by the
companion [`content-security-policy`](https://github.com/Jahia/content-security-policy) module:
`jmix:siteContentSecurityPolicy` and `jmix:pageContentSecurityPolicy`. The provisioning
(`assets/provisioning.yml`) therefore installs `content-security-policy` and the Digitall demo
site; `csp-editor` itself is deployed by the `@jahia/cypress` tooling via `MODULE_ID`.

The spec (`cypress/e2e/01-cspPolicyEditor.cy.ts`) is split in two:

- **CSP policy data contract (API)** — deterministic checks that the CSP mixins exist and the
  `policy` property round-trips through the generic `jcr` GraphQL API. This is the data contract
  the editor depends on and is what runs reliably in CI.
- **CSP Policy Editor UI** — opens the Content Editor and asserts the custom editor renders and
  behaves (fullscreen toggle, syntax-highlight spans). The Content Editor navigation drives the
  live jContent UI; if the jContent route changes across Jahia versions, adjust the
  `openContentEditor` helper in the spec.

## Running

Two options are available to run the tests, you can either run everything in Docker or only run Jahia in Docker and run the tests using your local node.

### Run all in Docker

Once you have a built test container, the entirety of the tests, from environment provisioning to report generation, can be executed using a single command.

```bash
# Build the test container
> bash ci.build.sh
# Execute the tests
> bash ci.startup.sh
```

This is this exact process that will be used by the CI platform to execute the tests. And although it's definitely the easiest way of going through one run, it's also the method you're the less likely to use on a day-to-day (that would have been too easy, isn't it ?). 

The primary reason for this method to be "somewhat" reserved to the CI platform, is that it doesn't make it easy to develop new tests or debug one single test.

IMPORTANT: If you are using this method locally, do not forget that you will need to **rebuilt the test container** (`bash ci.build.sh`) for everytime a change is done in the `tests/` folder, otherwise your change will not make their way to the container.

### Run the tests on a local node

This is the method you will be using the most when developing or debug tests, and the major point of attention here concerns the use of the `env.run.sh` script.

As a reminder, the purpose of the `env.run.sh` script is to provision the environment **AND** execute the tests, in most cases you'd want to provision the environment only once, but run the tests multiple times.

```bash
# Fetch the necessary javascript dependencies
> yarn
# Run the docker environment, but without the tests
> ./ci.startup.sh notests
# Provision the environment and run the tests in headless once
> ./env.run.sh
# For bash
> ./set-env.sh
> yarn run e2e:debug
```

The advantage of this approach is that you'll get to run the tests in headless once, and although it delays a bit the time by which you can start developing, it also give you a good sense of whether your environment is setup properly.

Do *NOT* forget to load your environment variables using `source set-env.sh` prior to running Cypress, as well as **everytime you open a new terminal**.

In most situations you will end-up with a lot of unit tests, slightly less API e2e, and fewer UI e2e. Note that the purpose of these tests is to validate the proper behavior/operation of the module being developed. It would likely still be necessary to implement various high level integration tests to ensure your module operate well with other in different "real-life" deployment scenarios (but those tests are typically executed after merging of the code).