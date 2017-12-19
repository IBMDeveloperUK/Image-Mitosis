#!/bin/bash
npm cache clean -f
npm install -g n
n 8.9.1
echo "Waiting for 5 seconds..."
sleep 5
npm i