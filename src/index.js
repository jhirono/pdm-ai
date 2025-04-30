#!/usr/bin/env node

// src/index.js
const { program } = require('commander');
const chalk = require('chalk');
const parseCommand = require('./commands/parse');
const consolidateCommand = require('./commands/consolidate');
const abstractCommand = require('./commands/abstract');

// Set up CLI program details
program
  .name('pdm')
  .description('ProDuct Manager (PDM) - A CLI tool for organizing customer feedback into product insights')
  .version('0.1.0');

// Register commands
parseCommand(program);
consolidateCommand(program);
abstractCommand(program);

// Handle unknown commands
program.on('command:*', (operands) => {
  console.error(chalk.red(`Error: unknown command '${operands[0]}'`));
  console.log();
  program.help();
});

// Parse command line arguments
program.parse(process.argv);

// Show help if no arguments provided
if (process.argv.length === 2) {
  program.help();
}