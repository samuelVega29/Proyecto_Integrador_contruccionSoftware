# instalaciones:

npm install express multer csv-parser mysql2
npm install bcrypt
npm install ejs
npm install sequelize mysql2 bcryptjs express-session body-parser
npm install bcryptjs


# base de datos

CREATE DATABASE IF NOT EXISTS csv_database1;
USE csv_database1;

CREATE TABLE users (
    id INT(11) NOT NULL AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL,
    identification VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    role ENUM('admin', 'docente', 'estudiante') NOT NULL,
    username VARCHAR(255) NOT NULL UNIQUE,
    PRIMARY KEY (id)
);

# ejs: 
EJS (Embedded JavaScript) es un motor de plantillas que permite generar HTML dinámico en aplicaciones web utilizando JavaScript. 

* La sintaxis de EJS:
Permite insertar variables y estructuras de control directamente en el HTML:
* utilizando los delimitadores: <%= %> para la salida de variables y <% %> para ejecutar código JavaScript.
* Por ejemplo:
 <%= user.name %> inserta el nombre del usuario en la página, y el código <% users.forEach(user => { %> permite iterar sobre un array de usuarios.


# tabla proyectos en la base de datos----------------------------------------------------------------------


CREATE TABLE projects (
    id INT(11) NOT NULL AUTO_INCREMENT,
    project_code VARCHAR(255) NOT NULL UNIQUE,
    project_name VARCHAR(255) NOT NULL UNIQUE,
    project_type ENUM('pasantía', 'artículo', 'trabajo de grado') NOT NULL,
    teacher_id INT(11) DEFAULT NULL,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    FOREIGN KEY (teacher_id) REFERENCES users(id)
);

* createdAt:
Se establece con un valor predeterminado de CURRENT_TIMESTAMP para almacenar la fecha y hora en la que se inserta el registro.
* updatedAt:
Se establece con CURRENT_TIMESTAMP como valor predeterminado, y se actualiza automáticamente cada vez que el registro es modificado, gracias a la cláusula ON UPDATE CURRENT_TIMESTAMP.
