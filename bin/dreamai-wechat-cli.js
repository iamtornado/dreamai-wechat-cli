#!/usr/bin/env node
/**
 * npm 发布的可执行入口：指向构建产物，避免部分 npm 版本对 dist 下 bin 校验异常。
 */
import "../dist/cli.js";
