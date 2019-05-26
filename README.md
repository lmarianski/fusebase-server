# FuseBase
A C&C ~botnet~ server made in nodejs

# NOTE
I don't take any responsibility for what you will do with this software/code.
Remember that running malicious code on someone's machine without their knowledge is illegal.

# Documentation / Build Status
[![Docs Status](https://lukas2005.github.io/FuseBase/badge.svg)](https://lukas2005.github.io/FuseBase/)
[![Build Status](https://travis-ci.org/lukas2005/FuseBase.svg?branch=master)](https://travis-ci.org/lukas2005/FuseBase)

# Prerequisities
1. Latest Nodejs

# How to:
## Step 1: Fork, Clone & Install
1. Fork this repo (it will be handy later, altho you can skip this if you have a place to host js files)
2. Clone/Download the repo to your PC
3. Run `npm install` in the root

## Step 2: Run and JS inclusion
1. Run `npm start` in the root dir
2. Edit `src/client/client.js` with any text editor and change the `nodeJsIp` const to `http://yourip:3000` (you might wanna get a DDNS)
3. (Here is where the hosting part comes in) grab a link to `src/client/client.js` and include it wherever u wanna spread ur evilness (or goodness depending on what ur doing) AKA normal `<script src="link"></script>` anywhere in the html.
4. Get into the W.I.P Control Panel `yourip:3000`

## Step 3: Use existing modules or write your own:
See the [Documentation](https://lukas2005.github.io/FuseBase/)
