#!/bin/bash

SCOPE="https://www.googleapis.com/auth/gmail.readonly"

googleauth --scope="$SCOPE" \
  --client_id=$CLIENT_ID \
  --client_secret=$CLIENT_SECRET
