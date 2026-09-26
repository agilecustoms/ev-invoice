# Changelog

## [1.13.0](https://github.com/agilecustoms/ev-invoice/compare/1.12.2...1.13.0) (2026-09-26)

### Features

* update nestjs and pino ([c753145](https://github.com/agilecustoms/ev-invoice/commit/c7531453f2077c6823586cafe79ae7237e806d8c))


## [1.12.2](https://github.com/agilecustoms/ev-invoice/compare/1.12.1...1.12.2) (2026-09-26)

### Miscellaneous

* simplify how path normalized ([db9f9d0](https://github.com/agilecustoms/ev-invoice/commit/db9f9d012d6cf13ec7eb26a5308ef5fc6750416a))


## [1.12.1](https://github.com/agilecustoms/ev-invoice/compare/1.12.0...1.12.1) (2026-09-26)

### Miscellaneous

* simplify work with aws request id and awg request id ([1360ab3](https://github.com/agilecustoms/ev-invoice/commit/1360ab3d5658a25eb10b7d0ff76ccec2b5e584b3))


## [1.12.0](https://github.com/agilecustoms/ev-invoice/compare/1.11.0...1.12.0) (2026-09-26)

### Features

* load paypal secret lazily ([a42eea7](https://github.com/agilecustoms/ev-invoice/commit/a42eea77fe864b7513262de0407b7714173e19b6))

### Bug Fixes

* logging ([e59bad5](https://github.com/agilecustoms/ev-invoice/commit/e59bad55ef21a8be98aebdad40a5926c75a1ef67))

### Miscellaneous

* change how nest bootstrap logs skipped ([95caa4f](https://github.com/agilecustoms/ev-invoice/commit/95caa4f39cd6e118ba73f0ef9f0ae2b6aa2e55f4))
* fix pino settings format ([3556e76](https://github.com/agilecustoms/ev-invoice/commit/3556e766631647039126e7aa01b08a63823bbc23))
* improve formatting, comments ([fcdfa7d](https://github.com/agilecustoms/ev-invoice/commit/fcdfa7dc333caec2c13a70cfb00d3b6e4e8b3abd))
* move APP_NAME in one place ([2f218f7](https://github.com/agilecustoms/ev-invoice/commit/2f218f7d521f78a5a40eae407967e671ada4399a))


## [1.11.0](https://github.com/agilecustoms/ev-invoice/compare/1.10.1...1.11.0) (2026-09-25)

### Features

* evolve CreateInvoice DTO ([a4a7732](https://github.com/agilecustoms/ev-invoice/commit/a4a773298b004005d6e86cb925d36386442d2a9f))


## [1.10.1](https://github.com/agilecustoms/ev-invoice/compare/1.10.0...1.10.1) (2026-09-24)

### Miscellaneous

* PayPal url configuration change ([638163d](https://github.com/agilecustoms/ev-invoice/commit/638163d44470686f1f4c4f3dcd252dfcced94f6b))


## [1.10.0](https://github.com/agilecustoms/ev-invoice/compare/1.9.0...1.10.0) (2026-09-24)

### Features

* add create invoice endpoint [skip ci] ([fef39f9](https://github.com/agilecustoms/ev-invoice/commit/fef39f9af989cadcbee3af0560b12fc18315fe12))
* initial version that can create invoices ([223cecc](https://github.com/agilecustoms/ev-invoice/commit/223cecc2fca87a44c5b7f3f043e51b90720d217b))

### Bug Fixes

* tests with adding import 'reflect-metadata' ([380e702](https://github.com/agilecustoms/ev-invoice/commit/380e7023894e5a6faf7db5a8813cb3a6f25cb1e5))

### Miscellaneous

* bruno collection to work with paypal api ([e1d90a5](https://github.com/agilecustoms/ev-invoice/commit/e1d90a5b1a2e523e075838e690805ef382dcbd28))


## [1.9.0](https://github.com/agilecustoms/ev-invoice/compare/1.8.2...1.9.0) (2026-09-22)

### Features

* add live vs sandbox switch ([9518310](https://github.com/agilecustoms/ev-invoice/commit/95183102420d3b180466d67d20e1ac9736686656))


## [1.8.2](https://github.com/agilecustoms/ev-invoice/compare/1.8.1...1.8.2) (2026-09-21)

### Miscellaneous

* optimize package ([35f05ff](https://github.com/agilecustoms/ev-invoice/commit/35f05ffa4ee94907a80b432f2f89a67bf592dd02))
* reshuffle files according to nest best practices ([212e37b](https://github.com/agilecustoms/ev-invoice/commit/212e37bfb39bfb5d9b852ccdabdcda67ec507c35))


## [1.8.1](https://github.com/agilecustoms/ev-invoice/compare/1.8.0...1.8.1) (2026-09-21)

### Miscellaneous

* move files ([8f086e8](https://github.com/agilecustoms/ev-invoice/commit/8f086e8d67d3bc0af40ecc2144aaff08b0a584c8))


## [1.8.0](https://github.com/agilecustoms/ev-invoice/compare/1.7.0...1.8.0) (2026-09-21)

### Features

* async wire creds from secrets manager ([8b8a763](https://github.com/agilecustoms/ev-invoice/commit/8b8a7632c0f9422e0c9ed7bdc7b6fbce1b6669d4))
* provision an empty secret ([2fdb3ad](https://github.com/agilecustoms/ev-invoice/commit/2fdb3ad0f844b809bf6538760ca45ee6255db0cf))

### Bug Fixes

* checkov exclusions ([252700e](https://github.com/agilecustoms/ev-invoice/commit/252700e8c7349213fabd1d1b530fed233c7b75c3))
* openapi generation ([3b9dd00](https://github.com/agilecustoms/ev-invoice/commit/3b9dd0074f553bfe3f3999d08165f0373409393b))


## [1.7.0](https://github.com/agilecustoms/ev-invoice/compare/1.6.2...1.7.0) (2026-09-20)

### Features

* create invoice endpoint ([1071aed](https://github.com/agilecustoms/ev-invoice/commit/1071aedd8a34f838e8e26f4daa6b8ef3b2938da2))
* create invoice skeleton ([5bb94bc](https://github.com/agilecustoms/ev-invoice/commit/5bb94bc45cae8c5a6782dece0db4ca139782a321))


## [1.6.2](https://github.com/agilecustoms/ev-invoice/compare/1.6.1...1.6.2) (2026-09-20)

### Bug Fixes

* rollback some upgrades to fix lambda at runtime ([40ce1ca](https://github.com/agilecustoms/ev-invoice/commit/40ce1ca4010932bf6c7737734a82953c6e7acc4a))


## [1.6.1](https://github.com/agilecustoms/ev-invoice/compare/1.6.0...1.6.1) (2026-09-20)

### Bug Fixes

* health path ([eb90ec2](https://github.com/agilecustoms/ev-invoice/commit/eb90ec22936cab8e0cc3b5560bfe155b8b70a790))

### Miscellaneous

* remove build warning [skip ci] ([23be312](https://github.com/agilecustoms/ev-invoice/commit/23be312c35c4803f223efb2f07f8284a791b00b0))


## [1.6.0](https://github.com/agilecustoms/ev-invoice/compare/1.5.1...1.6.0) (2026-09-20)

### Features

* update dependencies ([c816474](https://github.com/agilecustoms/ev-invoice/commit/c8164744ed062e62a14fd30dec3bdfc02e79787b))


## [1.5.1](https://github.com/agilecustoms/ev-invoice/compare/1.5.0...1.5.1) (2026-09-20)

### Bug Fixes

* invoke_arn ([9164968](https://github.com/agilecustoms/ev-invoice/commit/91649685bfd9f11264d9bc49174839cba7cbc105))
* service name and headers to log [skip ci] ([87ff1d7](https://github.com/agilecustoms/ev-invoice/commit/87ff1d729e6bb6e3b41ad3137911ac700687f024))


## [1.5.0](https://github.com/agilecustoms/ev-invoice/compare/1.4.0...1.5.0) (2026-09-20)

### Features

* make lambda handler work with both REST API and HTTP API ([e930a5a](https://github.com/agilecustoms/ev-invoice/commit/e930a5a7859036db2a0250946a42e763ddcc9549))

### Miscellaneous

* reshape normalizePath function ([1a52b4e](https://github.com/agilecustoms/ev-invoice/commit/1a52b4ebccb014deb8e0287cc44403fb59d121ec))


## [1.4.0](https://github.com/agilecustoms/ev-invoice/compare/1.3.3...1.4.0) (2026-09-20)

### Features

* add bruno collection ([cf565f8](https://github.com/agilecustoms/ev-invoice/commit/cf565f8ce5b6d385f55d2b0dff6528d49b14a6ec))
* invoice service stub ([5c7a4e4](https://github.com/agilecustoms/ev-invoice/commit/5c7a4e48be105f7ad23b2ea1d961060c123f204a))

### Bug Fixes

* openapi generation ([688bf4c](https://github.com/agilecustoms/ev-invoice/commit/688bf4c959f4d484998db51bb7f703aa9119c755))

### Miscellaneous

* rename base directory to invoice ([f6e8c35](https://github.com/agilecustoms/ev-invoice/commit/f6e8c3551e2d6be9c6da588e740259888dd726f9))


## [1.3.3](https://github.com/agilecustoms/ev-invoice/compare/1.3.2...1.3.3) (2026-09-20)

### Bug Fixes

* condition to upload artifacts ([c5a395c](https://github.com/agilecustoms/ev-invoice/commit/c5a395c8d9b82880ad09d2c623b228023dfc7b43))


## [1.3.2](https://github.com/agilecustoms/ev-invoice/compare/1.3.1...1.3.2) (2026-09-20)

### Miscellaneous

* generate openapi as part of build ([246b592](https://github.com/agilecustoms/ev-invoice/commit/246b59241b7d6322a82916d15b1a55e02fe72970))


## [1.3.1](https://github.com/agilecustoms/ev-invoice/compare/1.3.0...1.3.1) (2026-09-20)

### Miscellaneous

* add output 'apis' ([d98bbfb](https://github.com/agilecustoms/ev-invoice/commit/d98bbfbe509743b4b1caccf02a9da3e2717bf199))


## [1.3.0](https://github.com/agilecustoms/ev-invoice/compare/1.2.1...1.3.0) (2026-09-20)

### Features

* copy-paste from tt-invoice ([c90fbe8](https://github.com/agilecustoms/ev-invoice/commit/c90fbe8b8043cc5240401f308264e4d2bf651171))

### Miscellaneous

* add gclid to [Book Your Service] url to pass to Tally ([111534b](https://github.com/agilecustoms/ev-invoice/commit/111534b63a900f879d272b38979d6df8522d0944))
* combine book_makeup_click event and fixing url with gclid [skip ci] ([e499bbe](https://github.com/agilecustoms/ev-invoice/commit/e499bbe738fb37665fbee1e3dd660b425b6c8cbd))
* count book_makeup_click when someone clicks [Book Your Service] ([0e8ee86](https://github.com/agilecustoms/ev-invoice/commit/0e8ee8650216a780504a2111479d12ffcb89cecb))
* google analytics and google ads in head ([93a1d21](https://github.com/agilecustoms/ev-invoice/commit/93a1d21d6cba60142f169cfba9f59c7c11c0938d))


## [1.2.1](https://github.com/agilecustoms/ev-invoice/compare/1.2.0...1.2.1) (2026-08-22)

### Miscellaneous

* rename log group ([06b033d](https://github.com/agilecustoms/ev-invoice/commit/06b033d8a4343c5dcd9fb3928f26f34640c78c0f))


## [1.2.0](https://github.com/agilecustoms/ev-invoice/compare/1.1.0...1.2.0) (2026-08-17)

### Features

* traceparent ([3128739](https://github.com/agilecustoms/ev-invoice/commit/3128739ab9cdbab7bd4458eb2a677007b9d174f6))


## [1.1.0](https://github.com/agilecustoms/ev-invoice/compare/1.0.3...1.1.0) (2026-08-17)

### Features

* pino logger ([5ee112b](https://github.com/agilecustoms/ev-invoice/commit/5ee112b3c15b3e5502440443847c31b6d068cb51))
* pino logger [skip ci] ([b224eb1](https://github.com/agilecustoms/ev-invoice/commit/b224eb1e16fa602ea2cf072442f18586670f25b5))


## [1.0.3](https://github.com/agilecustoms/ev-invoice/compare/1.0.2...1.0.3) (2026-08-16)

### Miscellaneous

* add empty line to retest release flow ([14e8993](https://github.com/agilecustoms/ev-invoice/commit/14e8993cbe1ae8835fa9d742f6176891c568ef0d))


## [1.0.2](https://github.com/agilecustoms/ev-invoice/compare/1.0.1...1.0.2) (2026-08-16)

### Bug Fixes

* release workflow 2 ([54f7bf0](https://github.com/agilecustoms/ev-invoice/commit/54f7bf098557f481e5a61a1b76ad76087d3eb745))


## [1.0.1](https://github.com/agilecustoms/ev-invoice/compare/1.0.0...1.0.1) (2026-08-16)

### Bug Fixes

* release workflow ([3d8d1ff](https://github.com/agilecustoms/ev-invoice/commit/3d8d1ff5aeae2b9a7cdc01fe95608dd92e17f29f))


# Changelog

## 1.0.0 (2026-08-16)

### Features

* initial version ([5454d71](https://github.com/agilecustoms/ev-invoice/commit/5454d71830c37ba0057ff278f0f965e847415912))