'use strict'
const chalk = require('chalk')
const { execSync } = require('child_process')
const createPackageJson = require('create-package-json')
const fs = require('fs-extra')
const path = require('path')
const pkg = require('./package.json')
const config = require('./config.json')

const { commands, dependencies, devDependencies } = config

const logStep = (k, ...s) => console.log(`${chalk.bold(chalk.cyan(`${k.toUpperCase()}\t`))} ${config.steps[k]}${s}.`)
const runCommand = (command) => {
  try {
    execSync(`${command}`, { stdio: 'inherit' })
  } catch (err) {
    console.error(`Failed command "${command}"`, err)
    return false
  }
  return true
}
const runCommands = (commandList) => runCommand(commandList.join(' && '))

module.exports = async ({ directory, silent, withFetch, withDocker, withCommitlint }) => {
  const cd = `cd ${directory}`

  const packageOptions = {
    ...config.options,
    prompt: !silent,
    directory,
    name: directory,
    description: `Project created with ${pkg.name}`,
    dependencies: [...dependencies, ...(withFetch ? config.extraDeps.fetch : [])],
    devDependencies: [...devDependencies, ...(withCommitlint ? config.extraDeps.commitlint : [])],
    scripts: withCommitlint
      ? config.options.scripts
      : { ...config.options.scripts, ...config.extraOptions.commitlint.scripts },
  }

  logStep('start', chalk.cyan(directory))

  try {
    await fs.copy(path.join(__dirname, 'templates/base'), directory)
    logStep('base')

    if (withFetch) {
      await fs.copy(path.join(__dirname, 'templates/fetch/utils.mjs'), path.join(directory, 'src/utils/utils.mjs'))
      logStep('fetch')
    }

    if (withDocker) {
      await fs.copy(path.join(__dirname, 'templates/docker'), directory)
      logStep('docker')
    }

    if (withCommitlint) {
      await fs.copy(path.join(__dirname, 'templates/commitlint'), directory)
      logStep('commitlint')
    }
  } catch (err) {
    console.error(err)
    return
  }

  await createPackageJson(packageOptions)
  logStep('npm')

  if (runCommands([cd, `${commands.gitInit} ${silent ? '--quiet' : ''}`])) logStep('git')
  if (runCommands([cd, commands.createLocalEnv])) logStep('env')
  if (runCommands([cd, ...commands.huskyCommands])) logStep('husky')
  if (withCommitlint && runCommands([cd, commands.huskyCommitlint])) logStep('commitlint_hook')
  if (runCommands([cd, commands.gitAdd, `${commands.gitCommit} ${silent ? '--quiet' : ''}`])) logStep('commit')
}
