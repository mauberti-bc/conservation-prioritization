# How to contribute

Government employees, public and members of the private sector are encouraged to contribute to the repository by **forking and submitting a pull request**.

(If you are new to GitHub, you might start with a [basic tutorial](https://help.github.com/articles/set-up-git) and check out a more detailed guide to [pull requests](https://help.github.com/articles/using-pull-requests/).)

Pull requests will be evaluated by the repository guardians on a schedule and if deemed beneficial will be committed to the `main` branch.

All contributors retain the original copyright to their stuff, but by contributing to this project, you grant a world-wide, royalty-free, perpetual, irrevocable, non-exclusive, transferable license to all users **under the terms of the license under which this project is distributed.**

By participating in this project you agree to abide by its [Code of Conduct](CODE_OF_CONDUCT.md).

## Before you start

- **Bugs and feature requests:** search the existing [issues](https://github.com/bcgov/conservation-prioritization/issues) first. If nothing matches, open a new issue describing the problem or idea, including steps to reproduce bugs.
- **Larger changes:** open an issue to discuss the approach before writing code.
- **Security vulnerabilities:** do not report these in a public issue. Use GitHub's [private vulnerability reporting](https://github.com/bcgov/conservation-prioritization/security/advisories/new) instead.

## Making a change

1. Fork the repository and create a branch from `main`.
2. Follow the conventions already used in the code you are editing. [AGENTS.md](AGENTS.md) describes the project's coding conventions.
3. Add or update tests for the behaviour you changed, and make sure the test suites pass:

   ```bash
   make test
   ```

4. Open a pull request against `main` that explains what changed and why, and links any related issue. Automated checks, including the Trivy security scan, must pass.

## Repository guardians

- Macgregor Aubertin-Young ([mauberti-bc](https://github.com/mauberti-bc))
