import sqlite3

# 1. Open our new notebook
connection = sqlite3.connect("football_team.db")
cursor = connection.cursor()

# 2 Draw our table with columns for our players
cursor.execute("""
  CREATE TABLE IF NOT EXISTS players(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    position TEXT,
    shirt_number INTEGER,
    goals INTEGER
  )
 """)

# 3.Write a program to insert our first player into "players" table
cursor.execute(""" 
  INSERT INTO players (name, position, shirt_number, goals)
  VALUES ('Alex', 'Striker', 9, 5)
""")

print("Alex has been added to the team notebook")


# 4. Inserting goal keeper to our "players" table

cursor.execute("""
  INSERT INTO players(name, position, shirt_number, goals)
  VALUES ('Clement', 'Goal-keeper', 1, 0)
 """)

# 5. Ask the database to give us all the players

cursor.execute("""
 SELECT * FROM players
"""
               )

# 6. Grab all rows of data
print("Here is our current list")
all_players = cursor.fetchall()
for player in all_players:
    print(player[1])

connection.commit()
connection.close()
