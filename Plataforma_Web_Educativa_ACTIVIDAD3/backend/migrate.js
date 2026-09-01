const db = require('./src/config/database');

db.serialize(() => {
    db.run("ALTER TABLE preinscripciones ADD COLUMN alumno_dni TEXT", (err) => {
        if (err) {
            if (err.message.includes("duplicate column name")) {
                console.log("Column alumno_dni already exists.");
            } else {
                console.error("Error adding column:", err.message);
            }
        } else {
            console.log("Column alumno_dni added successfully.");
        }
    });
});
