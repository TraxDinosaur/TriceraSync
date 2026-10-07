# Contributing to TriceraSync

Thank you for your interest in contributing to TriceraSync!

## Code of Conduct

Please maintain a collaborative, respectful, and constructive environment.

## Prerequisites

- **JDK 17** (e.g. Eclipse Adoptium Temurin or OpenJDK 17)
- **Android SDK** with:
  - `platform-tools`
  - `platforms;android-35`
  - `build-tools;35.0.0`
- Set `ANDROID_HOME` in your environment or specify `sdk.dir=/path/to/sdk` in a local `local.properties` file.

## Development Workflow

1. **Fork and clone** the repository.
2. Create a feature branch:
   ```bash
   git checkout -b feature/my-new-feature
   ```
3. Run the unit test suite to verify baseline functionality:
   ```bash
   ./gradlew testDebugUnitTest
   ```
4. Build the debug APK:
   ```bash
   ./gradlew assembleDebug
   ```

## Coding Conventions

- **Kotlin**: Follow official Kotlin coding conventions.
- **Contract Integrity**: Any modifications to `core/pcf/Pcf.kt` or `core/matching/Normalize.kt` must remain fully backward-compatible with the PCF v1 specification (`pcf/SPECIFICATION.md`) and pass all shared normalization vectors (`pcf/normalize-vectors.json`).
- **Actuators**: Hardware actuators must always maintain baseline capture and safe restoration rules. Never leave system brightness, volume, or torch in modified states when a sync session ends.

## Pull Request Guidelines

- Ensure `./gradlew testDebugUnitTest` passes cleanly before opening a pull request.
- Keep changes focused and minimal.
- Describe what changed, why, and how it was tested (including physical device models if testing hardware actuators).

## Licensing

By submitting code to TriceraSync, you agree that your contributions will be licensed under the project's respective open-source licenses (GPL-3.0-or-later for Engine, AGPL-3.0-or-later for Studio).
