/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/refai_escrow.json`.
 */
export type RefaiEscrow = {
  "address": "5YpYBhXdpqUuw7gpmsuoL3bsyW9XYsAVxBqeh3Mj2aHz",
  "metadata": {
    "name": "refaiEscrow",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "RefAI on-chain escrow for trustless betting"
  },
  "docs": [
    "RefAI Escrow — trustless 1-v-1 betting with an AI referee.",
    "",
    "Flow:",
    "1. Player A calls `init_escrow`  → creates PDA, deposits SOL",
    "2. Player B calls `join_escrow`  → deposits matching SOL",
    "3. Referee (backend keypair) calls `settle_escrow` → winner receives pot",
    "OR either player calls `cancel_escrow` before opponent joins."
  ],
  "instructions": [
    {
      "name": "cancelEscrow",
      "docs": [
        "Cancel an escrow before Player B joins — refunds Player A."
      ],
      "discriminator": [
        156,
        203,
        54,
        179,
        38,
        72,
        33,
        21
      ],
      "accounts": [
        {
          "name": "escrow",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  101,
                  115,
                  99,
                  114,
                  111,
                  119
                ]
              },
              {
                "kind": "arg",
                "path": "matchId"
              }
            ]
          }
        },
        {
          "name": "playerA",
          "writable": true,
          "signer": true
        }
      ],
      "args": [
        {
          "name": "matchId",
          "type": "string"
        }
      ]
    },
    {
      "name": "initEscrow",
      "docs": [
        "Player A creates the escrow and deposits `lamports`."
      ],
      "discriminator": [
        70,
        46,
        40,
        23,
        6,
        11,
        81,
        139
      ],
      "accounts": [
        {
          "name": "escrow",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  101,
                  115,
                  99,
                  114,
                  111,
                  119
                ]
              },
              {
                "kind": "arg",
                "path": "matchId"
              }
            ]
          }
        },
        {
          "name": "playerA",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "matchId",
          "type": "string"
        },
        {
          "name": "lamports",
          "type": "u64"
        },
        {
          "name": "referee",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "joinEscrow",
      "docs": [
        "Player B joins the escrow and deposits the matching stake."
      ],
      "discriminator": [
        205,
        250,
        117,
        19,
        126,
        211,
        205,
        103
      ],
      "accounts": [
        {
          "name": "escrow",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  101,
                  115,
                  99,
                  114,
                  111,
                  119
                ]
              },
              {
                "kind": "arg",
                "path": "matchId"
              }
            ]
          }
        },
        {
          "name": "playerB",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "matchId",
          "type": "string"
        }
      ]
    },
    {
      "name": "settleEscrow",
      "docs": [
        "Referee settles the escrow — sends the full pot to the winner."
      ],
      "discriminator": [
        22,
        135,
        160,
        194,
        23,
        186,
        124,
        110
      ],
      "accounts": [
        {
          "name": "escrow",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  101,
                  115,
                  99,
                  114,
                  111,
                  119
                ]
              },
              {
                "kind": "arg",
                "path": "matchId"
              }
            ]
          }
        },
        {
          "name": "referee",
          "signer": true
        },
        {
          "name": "winner",
          "writable": true
        }
      ],
      "args": [
        {
          "name": "matchId",
          "type": "string"
        },
        {
          "name": "winner",
          "type": "pubkey"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "escrow",
      "discriminator": [
        31,
        213,
        123,
        187,
        186,
        22,
        218,
        155
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "zeroStake",
      "msg": "Stake must be greater than zero"
    },
    {
      "code": 6001,
      "name": "matchIdTooLong",
      "msg": "Match ID must be ≤ 32 characters"
    },
    {
      "code": 6002,
      "name": "notInitialized",
      "msg": "Escrow not initialized"
    },
    {
      "code": 6003,
      "name": "alreadyFull",
      "msg": "Both players have already deposited"
    },
    {
      "code": 6004,
      "name": "alreadySettled",
      "msg": "Escrow has already been settled"
    },
    {
      "code": 6005,
      "name": "notFull",
      "msg": "Both deposits required before settling"
    },
    {
      "code": 6006,
      "name": "invalidWinner",
      "msg": "Winner must be player A or player B"
    },
    {
      "code": 6007,
      "name": "unauthorizedReferee",
      "msg": "Only the designated referee can settle"
    },
    {
      "code": 6008,
      "name": "winnerMismatch",
      "msg": "Winner account does not match the declared winner"
    },
    {
      "code": 6009,
      "name": "unauthorized",
      "msg": "unauthorized"
    }
  ],
  "types": [
    {
      "name": "escrow",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "matchId",
            "type": "string"
          },
          {
            "name": "playerA",
            "type": "pubkey"
          },
          {
            "name": "playerB",
            "type": "pubkey"
          },
          {
            "name": "referee",
            "type": "pubkey"
          },
          {
            "name": "stake",
            "type": "u64"
          },
          {
            "name": "playerADeposited",
            "type": "bool"
          },
          {
            "name": "playerBDeposited",
            "type": "bool"
          },
          {
            "name": "settled",
            "type": "bool"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    }
  ]
};
