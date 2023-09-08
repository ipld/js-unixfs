# Changelog

## [2.1.2](https://github.com/ipld/js-unixfs/compare/v2.1.1...v2.1.2) (2023-09-08)


### Bug Fixes

* queue layout export ([#46](https://github.com/ipld/js-unixfs/issues/46)) ([74a473a](https://github.com/ipld/js-unixfs/commit/74a473a6098e3271cb1359b481d4f8c994f77119))
* write to balanced layout at width ([#52](https://github.com/ipld/js-unixfs/issues/52)) ([989d96a](https://github.com/ipld/js-unixfs/commit/989d96a52e745295e9e3816402651a52443924ec))

## [2.1.1](https://github.com/ipld/js-unixfs/compare/v2.1.0...v2.1.1) (2023-03-14)


### Bug Fixes

* types for export paths ([#44](https://github.com/ipld/js-unixfs/issues/44)) ([eff8659](https://github.com/ipld/js-unixfs/commit/eff86595e60491c7080a95f8e30698f03880b511))

## [2.1.0](https://github.com/ipld/js-unixfs/compare/v2.0.1...v2.1.0) (2023-03-14)


### Features

* add HAMT sharded directories support ([#41](https://github.com/ipld/js-unixfs/issues/41)) ([fb87f9d](https://github.com/ipld/js-unixfs/commit/fb87f9d04ffd4d6ff167dcd9f7148fd735f65beb))

## [2.0.1](https://github.com/ipld/js-unixfs/compare/v2.0.0-dev...v2.0.1) (2023-01-18)


### Bug Fixes

* update multiformats ([#39](https://github.com/ipld/js-unixfs/issues/39)) ([2aaed3d](https://github.com/ipld/js-unixfs/commit/2aaed3d50302f89ff482a0794c4186ab4a05e696))


### Miscellaneous Chores

* release 2.0.1 ([90d8731](https://github.com/ipld/js-unixfs/commit/90d8731077a98d2fbbe503e058a2c34514dca841))

## [2.0.0](https://github.com/ipld/js-unixfs/compare/v1.1.0-dev...v2.0.0) (2022-10-12)


### ⚠ BREAKING CHANGES

* upgrade to multiformat@10 (#33)

### Features

* remove dev from package version ([#35](https://github.com/ipld/js-unixfs/issues/35)) ([7edd5c0](https://github.com/ipld/js-unixfs/commit/7edd5c03684b5c971423bfd85c8d4e00f5cd8fbb))
* upgrade to multiformat@10 ([#33](https://github.com/ipld/js-unixfs/issues/33)) ([6b24fb3](https://github.com/ipld/js-unixfs/commit/6b24fb36e9bb2d14ef6a54d4101792348fc2bb5a))


### Bug Fixes

* license name ([#25](https://github.com/ipld/js-unixfs/issues/25)) ([d1e404b](https://github.com/ipld/js-unixfs/commit/d1e404bb46db6aa5a155999c7abdd6de0fed1a47))

## [1.1.0-dev](https://github.com/ipld/js-unixfs/compare/v1.0.3-dev...v1.1.0-dev) (2022-07-29)


### Features

* implement flat dir support ([#27](https://github.com/ipld/js-unixfs/issues/27)) ([af49439](https://github.com/ipld/js-unixfs/commit/af494397b5f93782a0e30fd7bccc7117c2e96e07))

### [1.0.3-dev](https://github.com/ipld/js-unixfs/compare/v1.0.2-dev...v1.0.3-dev) (2022-03-28)


### Bug Fixes

* fix types exports ([#19](https://github.com/ipld/js-unixfs/issues/19)) ([3a83eb3](https://github.com/ipld/js-unixfs/commit/3a83eb36745e64dc39672ba5bd40b24faedd77e4))

### [1.0.2-dev](https://github.com/ipld/js-unixfs/compare/v1.0.1-dev...v1.0.2-dev) (2022-03-24)


### Bug Fixes

* skypack build by breaking import loop ([#15](https://github.com/ipld/js-unixfs/issues/15)) ([611401b](https://github.com/ipld/js-unixfs/commit/611401b467aad2db969b19e0dc84eeeefcfaa9d2))

### [1.0.1-dev](https://github.com/ipld/js-unixfs/compare/v1.0.0-dev...v1.0.1-dev) (2022-03-24)


### Bug Fixes

* provide more exports ([#13](https://github.com/ipld/js-unixfs/issues/13)) ([fef9564](https://github.com/ipld/js-unixfs/commit/fef95647f56bf9825e36dfc225c6bca8336ce308))

## 1.0.0-dev (2022-03-24)


### Features

* change layout engine & chunker interfaces ([#7](https://github.com/ipld/js-unixfs/issues/7)) ([6d8b9a9](https://github.com/ipld/js-unixfs/commit/6d8b9a94b31955bddbce91883736ee6a6f519610))
* improve chunker perf ([dcbe064](https://github.com/ipld/js-unixfs/commit/dcbe0641cdcf5ef8c1a0a78b2a31b3584c474648))


### Bug Fixes

* add public access ([9a3373d](https://github.com/ipld/js-unixfs/commit/9a3373d760e8e050550f6baa8c91d8da7e30547f))
* balanced layout ([d6fa08d](https://github.com/ipld/js-unixfs/commit/d6fa08dca63e680c933e8fb2119afbc586714fd7))
* bug in trickle layout logic ([8d0eecd](https://github.com/ipld/js-unixfs/commit/8d0eecdf227f4467a24626630075400a9cd9d277))
* bugs & add tests ([6be4ed4](https://github.com/ipld/js-unixfs/commit/6be4ed4d69b5e39c3cf9034f98f5624f01ecfbe1))
* create CIDv1 for raw blocks even if cidv is 0 ([9afb665](https://github.com/ipld/js-unixfs/commit/9afb6653baaccf302f65b469ddc8f000b17d72e4))
* drop unecessary reference ([e461d67](https://github.com/ipld/js-unixfs/commit/e461d67463a063044466f16f699bc5cde3fab1f8))
* id allocator ([3be5b42](https://github.com/ipld/js-unixfs/commit/3be5b429d5869b13aff13019af4fa316ca12d375))
* no content case ([fd75c19](https://github.com/ipld/js-unixfs/commit/fd75c19105c497f657a46d164d143b226c4fac2c))
* rabin tests parsing config incorrectly ([b2f36da](https://github.com/ipld/js-unixfs/commit/b2f36da80930ca036a4c42f133d8a7a7264d1e83))
* trickle dags ([6f0b501](https://github.com/ipld/js-unixfs/commit/6f0b501f941a7651a62e9fdcb744547123d70add))
* type errrors ([#8](https://github.com/ipld/js-unixfs/issues/8)) ([7233ea4](https://github.com/ipld/js-unixfs/commit/7233ea43c2700aee3ea00d17696d191dda452a95))


### Miscellaneous Chores

* release 1.0.0-dev ([a832830](https://github.com/ipld/js-unixfs/commit/a832830761c099ae753ac9b7c1660c1b4c46eaeb))
