import { sync } from 'fast-glob'
import { resolve } from 'path/posix'
import { Plugin, FSWatcher } from 'vite'
import { basename, extname } from 'path'
import type { Resolver } from 'unplugin-auto-import/dist/types'

let watcher: FSWatcher
let inServer: boolean = false

export const DirResolverHelper = (): Plugin => {
	return {
		enforce: 'pre',
		name: 'vite-auto-import-resolvers:dir-resolver-helper',
		config(config, { command }) {
			inServer = command === 'serve'
		},
		configureServer(server) {
			watcher = server.watcher
		}
	}
}

interface IGenModulesOptions {
	path: string
	prefix: string
	suffix: string
	include: string[]
	exclude: string[]
}

const getModuleName = (path: string) => {
	return basename(path, extname(path))
}

const genModules = (options: IGenModulesOptions) => {
	const { path, prefix, suffix, include, exclude } = options

	const existedModulesInInit = sync(`${path}/**/*`).map(
		getModuleName
	)

	const modules = new Set<string>([
		...include,
		...existedModulesInInit
	])

	if (inServer) {
		watcher.add(path)
		watcher.on('add', path => {
			const moduleName = getModuleName(path)
			const hasPrefix = moduleName.startsWith(prefix)
			const hasSuffix = moduleName.endsWith(suffix)

			const shouldAppend =
				hasPrefix &&
				hasSuffix &&
				!exclude.includes(moduleName)

			if (shouldAppend) {
				modules.add(moduleName)
			}
		})

		watcher.on('unlink', path => {
			const moduleName = getModuleName(path)
			if (include.includes(moduleName)) {
				return
			}
			if (modules.has(moduleName)) {
				modules.delete(moduleName)
			}
		})
	}
	return modules
}

interface Options {
	srcAlias?: string
	target?: string
	prefix?: string
	suffix?: string
	include?: string[]
	exclude?: string[]
}

export const dirResolver = (
	options?: Options
): Resolver => {
	const {
		srcAlias = '/src/',
		target = 'composables',
		suffix = '',
		prefix = '',
		include = [],
		exclude = []
	} = options || {}

	const modules = genModules({
		path: `./src/${target}`,
		suffix,
		prefix,
		include,
		exclude
	})
	return name => {
		if (modules.has(name)) {
			return resolve(srcAlias, target, name)
		}
	}
}
