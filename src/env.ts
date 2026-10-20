import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';

// Переменные окружения процесса имеют приоритет над значениями из файла.
if (existsSync('.env')) {
  loadEnvFile('.env');
}
