/**
 * RefAI Escrow — IDL (Interface Description Language)
 *
 * This is the TypeScript representation of the on-chain Anchor program.
 * After deploying with `anchor build && anchor deploy`, replace the
 * programId below with the actual deployed address.
 */
export type RefaiEscrow = {
  version: "0.1.0"
  name: "refai_escrow"
  instructions: [
    {
      name: "initEscrow"
      accounts: [
        { name: "escrow"; isMut: true; isSigner: false },
        { name: "playerA"; isMut: true; isSigner: true },
        { name: "systemProgram"; isMut: false; isSigner: false },
      ]
      args: [
        { name: "matchId"; type: "string" },
        { name: "lamports"; type: "u64" },
        { name: "referee"; type: "publicKey" },
      ]
    },
    {
      name: "joinEscrow"
      accounts: [
        { name: "escrow"; isMut: true; isSigner: false },
        { name: "playerB"; isMut: true; isSigner: true },
        { name: "systemProgram"; isMut: false; isSigner: false },
      ]
      args: [{ name: "matchId"; type: "string" }]
    },
    {
      name: "settleEscrow"
      accounts: [
        { name: "escrow"; isMut: true; isSigner: false },
        { name: "referee"; isMut: false; isSigner: true },
        { name: "winner"; isMut: true; isSigner: false },
      ]
      args: [
        { name: "matchId"; type: "string" },
        { name: "winner"; type: "publicKey" },
      ]
    },
    {
      name: "cancelEscrow"
      accounts: [
        { name: "escrow"; isMut: true; isSigner: false },
        { name: "playerA"; isMut: true; isSigner: true },
      ]
      args: [{ name: "matchId"; type: "string" }]
    },
  ]
  accounts: [
    {
      name: "Escrow"
      type: {
        kind: "struct"
        fields: [
          { name: "matchId"; type: "string" },
          { name: "playerA"; type: "publicKey" },
          { name: "playerB"; type: "publicKey" },
          { name: "referee"; type: "publicKey" },
          { name: "stake"; type: "u64" },
          { name: "playerADeposited"; type: "bool" },
          { name: "playerBDeposited"; type: "bool" },
          { name: "settled"; type: "bool" },
          { name: "bump"; type: "u8" },
        ]
      }
    },
  ]
  errors: [
    { code: 6000; name: "ZeroStake"; msg: "Stake must be greater than zero" },
    { code: 6001; name: "MatchIdTooLong"; msg: "Match ID must be ≤ 32 characters" },
    { code: 6002; name: "NotInitialized"; msg: "Escrow not initialized" },
    { code: 6003; name: "AlreadyFull"; msg: "Both players have already deposited" },
    { code: 6004; name: "AlreadySettled"; msg: "Escrow has already been settled" },
    { code: 6005; name: "NotFull"; msg: "Both deposits required before settling" },
    { code: 6006; name: "InvalidWinner"; msg: "Winner must be player A or player B" },
    { code: 6007; name: "UnauthorizedReferee"; msg: "Only the designated referee can settle" },
    { code: 6008; name: "WinnerMismatch"; msg: "Winner account does not match the declared winner" },
    { code: 6009; name: "Unauthorized"; msg: "Unauthorized" },
  ]
}

export const IDL: RefaiEscrow = {
  version: "0.1.0",
  name: "refai_escrow",
  instructions: [
    {
      name: "initEscrow",
      accounts: [
        { name: "escrow", isMut: true, isSigner: false },
        { name: "playerA", isMut: true, isSigner: true },
        { name: "systemProgram", isMut: false, isSigner: false },
      ],
      args: [
        { name: "matchId", type: "string" },
        { name: "lamports", type: "u64" },
        { name: "referee", type: "publicKey" },
      ],
    },
    {
      name: "joinEscrow",
      accounts: [
        { name: "escrow", isMut: true, isSigner: false },
        { name: "playerB", isMut: true, isSigner: true },
        { name: "systemProgram", isMut: false, isSigner: false },
      ],
      args: [{ name: "matchId", type: "string" }],
    },
    {
      name: "settleEscrow",
      accounts: [
        { name: "escrow", isMut: true, isSigner: false },
        { name: "referee", isMut: false, isSigner: true },
        { name: "winner", isMut: true, isSigner: false },
      ],
      args: [
        { name: "matchId", type: "string" },
        { name: "winner", type: "publicKey" },
      ],
    },
    {
      name: "cancelEscrow",
      accounts: [
        { name: "escrow", isMut: true, isSigner: false },
        { name: "playerA", isMut: true, isSigner: true },
      ],
      args: [{ name: "matchId", type: "string" }],
    },
  ],
  accounts: [
    {
      name: "Escrow",
      type: {
        kind: "struct",
        fields: [
          { name: "matchId", type: "string" },
          { name: "playerA", type: "publicKey" },
          { name: "playerB", type: "publicKey" },
          { name: "referee", type: "publicKey" },
          { name: "stake", type: "u64" },
          { name: "playerADeposited", type: "bool" },
          { name: "playerBDeposited", type: "bool" },
          { name: "settled", type: "bool" },
          { name: "bump", type: "u8" },
        ],
      },
    },
  ],
  errors: [
    { code: 6000, name: "ZeroStake", msg: "Stake must be greater than zero" },
    { code: 6001, name: "MatchIdTooLong", msg: "Match ID must be ≤ 32 characters" },
    { code: 6002, name: "NotInitialized", msg: "Escrow not initialized" },
    { code: 6003, name: "AlreadyFull", msg: "Both players have already deposited" },
    { code: 6004, name: "AlreadySettled", msg: "Escrow has already been settled" },
    { code: 6005, name: "NotFull", msg: "Both deposits required before settling" },
    { code: 6006, name: "InvalidWinner", msg: "Winner must be player A or player B" },
    { code: 6007, name: "UnauthorizedReferee", msg: "Only the designated referee can settle" },
    { code: 6008, name: "WinnerMismatch", msg: "Winner account does not match the declared winner" },
    { code: 6009, name: "Unauthorized", msg: "Unauthorized" },
  ],
}
