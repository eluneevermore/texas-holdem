-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "avatar_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "games_played" INTEGER NOT NULL DEFAULT 0,
    "games_won" INTEGER NOT NULL DEFAULT 0,
    "total_buy_ins" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rooms" (
    "id" TEXT NOT NULL,
    "room_code" TEXT NOT NULL,
    "host_id" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'WAITING',
    "hand_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closed_at" TIMESTAMP(3),
    "small_blind" INTEGER NOT NULL DEFAULT 10,
    "big_blind" INTEGER NOT NULL DEFAULT 20,
    "initial_stack" INTEGER NOT NULL DEFAULT 1000,
    "buy_in_allowed" BOOLEAN NOT NULL DEFAULT true,
    "buy_in_amount" INTEGER NOT NULL DEFAULT 1000,
    "max_players" INTEGER NOT NULL DEFAULT 9,

    CONSTRAINT "rooms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "room_players" (
    "id" TEXT NOT NULL,
    "room_id" TEXT NOT NULL,
    "player_id" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "is_bot" BOOLEAN NOT NULL DEFAULT false,
    "is_host" BOOLEAN NOT NULL DEFAULT false,
    "seat_index" INTEGER NOT NULL,
    "chips" INTEGER NOT NULL DEFAULT 1000,
    "player_state" TEXT NOT NULL DEFAULT 'WAITING',
    "buy_in_count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "room_players_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "game_hands" (
    "id" TEXT NOT NULL,
    "room_id" TEXT NOT NULL,
    "hand_number" INTEGER NOT NULL,
    "dealer_seat_index" INTEGER NOT NULL,
    "community_cards" JSONB NOT NULL DEFAULT '[]',
    "pots" JSONB NOT NULL DEFAULT '[]',
    "players" JSONB NOT NULL DEFAULT '[]',
    "winners" JSONB NOT NULL DEFAULT '[]',
    "phase" TEXT NOT NULL DEFAULT 'PRE_DEAL',
    "current_bet" INTEGER NOT NULL DEFAULT 0,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "game_hands_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "rooms_room_code_key" ON "rooms"("room_code");

-- CreateIndex
CREATE UNIQUE INDEX "room_players_room_id_player_id_key" ON "room_players"("room_id", "player_id");

-- AddForeignKey
ALTER TABLE "room_players" ADD CONSTRAINT "room_players_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_hands" ADD CONSTRAINT "game_hands_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
