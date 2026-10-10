from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import sqlite3

app = FastAPI()

app.add_middleware(
    CORSMiddleware,

    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

# =================== BLUE PRINT FOR ADDING PLAYER ================ #


class AddPlayer(BaseModel):
    name: str
    position: str
    number: str


# ========================== PLAYERS LIST ========================= #


@app.get("/players")
def get_players():
    connection = sqlite3.connect("football_team.db")
    cursor = connection.cursor()
    cursor.execute("SELECT * FROM players")

    players = cursor.fetchall()
    connection.close()

    players_list = []

    for player in players:
        players_list.append({
            "id": player[0],
            "name": player[1],
            "position": player[2],
            "shirt_number": player[3],
            "goals": player[4]
        })

    return {"team_squad": players_list}

# ============================= Adding Players ====================#


@app.post("/addplayer")
def add_player(player: AddPlayer):
    connection = sqlite3.connect("football_team.db")
    cursor = connection.cursor()
    cursor.execute("""
                INSERT INTO players (name, position, shirt_number)
                VALUES (?, ?, ?)
            """, (player.name, player.position, player.number))
    connection.commit()
    return {
        "message": "Player added successfully"
    }
