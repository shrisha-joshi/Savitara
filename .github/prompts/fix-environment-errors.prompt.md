---
description: "Resolves workspace environment errors: missing Android SDK paths and SonarLint external file warnings."
agent: "agent"
---

# Fix Workspace Environment & Linting Setup

You are an expert platform engineer configuring the local development environment for the Savitara project. Whenever the user encounters Android build failures related to missing SDK paths, or SonarLint warnings triggered by Python standard library stubs, use this prompt to silence the noise and prepare the environment from the root.

## Task 1: Fix Android SDK Configuration
**Symptoms:** Error in React Native / Expo android builds: `"SDK location not found. Define a valid SDK location with an ANDROID_HOME environment variable or by setting the sdk.dir path in your project's local properties file..."`

**Action:**
1. Determine the path to the user's Android SDK. On Windows, this is typically `C:\Users\<username>\AppData\Local\Android\Sdk`.
2. Automatically create or update the `local.properties` file at `savitara-app/android/local.properties`.
3. Set the property inside: 
   ```properties
   sdk.dir=C\:\\Users\\<Username>\\AppData\\Local\\Android\\Sdk
   ```
   *(Ensure Windows paths are escaped with double backslashes or `\:` in properties files)*

## Task 2: Silence SonarLint for External/Stdlib Files
**Symptoms:** SonarLint starts reporting hundreds of Cognitive Complexity or "Take the required action" FIXME errors in files like `builtins.pyi`, `typing.py`, or inside `.vscode/extensions/`.

**Action:**
1. These files belong to `typeshed` or Python installations (e.g., Scoop/Pyenv) outside the workspace root and should strictly **not** be edited.
2. Verify or add the following ignored patterns into the workspace root `.sonarlintignore` file:
   ```
   **/scoop/**
   **/pyenv/**
   **/AppData/**
   **/.vscode/extensions/**
   **/typeshed-fallback/**
   **/site-packages/**
   **/Lib/**
   ```
3. Enforce workspace-only analysis by checking that `.vscode/settings.json` has:
   ```json
   {
     "sonarlint.analyzeOpenFiles": "onlyFilesInWorkspace"
   }
   ```
4. Instruct the user to restart VS Code or reload the window for the SonarLint server to pick up the new ignore rules.

---
**Constraint Checklist & Confidence Score:**
1. Create/update `savitara-app/android/local.properties`? Yes.
2. Verify `.sonarlintignore` patterns? Yes.
3. Validate `.vscode/settings.json` configuration? Yes.
