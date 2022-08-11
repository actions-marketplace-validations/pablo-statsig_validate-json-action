import * as core from '@actions/core';
import { getConfig, verifyConfigValues } from './configuration';
import { validateJsons } from './json-validator';
import path from 'path';
import fs from 'fs';

function* walkSync(dir) {
    const files = fs.readdirSync(dir, { withFileTypes: true });
    for (const file of files) {
        if (file.isDirectory()) {
            yield* walkSync(path.join(dir, file.name));
        } else {
            yield path.join(dir, file.name);
        }
    }
}

async function run() {
    try {
        const configuration = getConfig();
        const configurationErrors = verifyConfigValues(configuration);
        if (configurationErrors) {
            configurationErrors.forEach(e => core.error(e));
            core.setFailed('Missing configuration');
            return;
        }

        let jsonRelativePaths = configuration.JSONS.split(',');
        if (jsonRelativePaths.length == 1 && jsonRelativePaths[0] == '*') {
            jsonRelativePaths = []
            const source_dir = configuration.GITHUB_WORKSPACE;
            for (var file_path in walkSync(source_dir)) {
                if (!file_path.endsWith('json')) continue;
                jsonRelativePaths.push(file_path)
            }
        }

        const validationResults = await validateJsons(
            configuration.GITHUB_WORKSPACE,
            configuration.SCHEMA,
            jsonRelativePaths
        );

        const invalidJsons = validationResults.filter(res => !res.valid).map(res => res.filePath);

        core.setOutput('INVALID', invalidJsons.length > 0 ? invalidJsons.join(',') : '');

        if (invalidJsons.length > 0) {
            core.setFailed('Failed to validate all JSON files.');
        } else {
            core.info(`✅ All files were validated successfully.`);
        }
    } catch (error) {
        core.setFailed(error.message);
    }
}

run();
