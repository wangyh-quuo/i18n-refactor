#!/usr/bin/env node

import { scanProject } from '../utils/scan';
import config from '../config';

scanProject(config.sourceDir);