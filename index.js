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
const getTpl = (key) => path.join(__dirname, config.templates[key])

module.exports = async (args) => {
  const { directory, silent, withFetch, withDocker, withCommitlint } = args
  const cd = `cd ${directory}`

  const packageOptions = {
    ...config.options,
    prompt: !silent,
    directory,
    name: directory,
    description: `Project created with ${pkg.name}`,
    dependencies: [
      ...dependencies,
      ...(withFetch ? config.extraDeps.fetch : []),
      ...(withDocker ? config.extraDeps.docker : []),
    ],
    devDependencies: [...devDependencies, ...(withCommitlint ? config.extraDeps.commitlint : [])],
    scripts: withCommitlint
      ? config.options.scripts
      : { ...config.options.scripts, ...config.extraOptions.commitlint.scripts },
  }

  logStep('start', chalk.cyan(directory))

  try {
    await fs.copy(getTpl('base'), directory)
    logStep('base')

    if (withFetch) {
      await fs.copy(getTpl('fetch'), path.join(directory, 'src/utils/utils.mjs'))
      logStep('fetch')
    }

    if (withDocker) {
      await fs.copy(getTpl('docker'), directory)
      logStep('docker')
    }

    if (withCommitlint) {
      await fs.copy(getTpl('commitlint'), directory)
      logStep('commitlint')
    }
  } catch (err) {
    console.error(err)
    return
  }

  logStep('npm-pre')
  await createPackageJson(packageOptions)
  logStep('npm')

  if (runCommands([cd, `${commands.gitInit} ${silent ? '--quiet' : ''}`])) logStep('git')
  if (runCommands([cd, commands.createLocalEnv])) logStep('env')
  if (runCommands([cd, ...commands.huskyCommands])) logStep('husky')
  if (withCommitlint && runCommands([cd, commands.huskyCommitlint])) logStep('commitlint_hook')
  if (runCommands([cd, commands.gitAdd, `${commands.gitCommit} ${silent ? '--quiet' : ''}`])) logStep('commit')
}
