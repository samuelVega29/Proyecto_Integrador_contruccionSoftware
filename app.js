// app.js

const express = require("express");
const bcrypt = require("bcryptjs");
const session = require("express-session");
const bodyParser = require("body-parser");
const path = require("path");
const sequelize = require("./db");
const User = require("./models/User"); // Importar el modelo de usuario

const { Op } = require("sequelize");

const app = express();
const PORT = process.env.PORT || 3000;

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));


app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));
app.use(
  session({
    secret: "usta2024",
    resave: false,
    saveUninitialized: true,
  })
);

// Middleware para verificar si el usuario está autenticado
function isAuthenticated(req, res, next) {
  if (req.session.userId) {
    return next();
  }
  res.redirect("/login");
}

// Middleware para verificar si el usuario es administrador
function isAdmin(req, res, next) {
  if (req.session.role === "admin") {
    return next();
  }
  res.status(403).send("Acceso denegado");
}

// Rutas
app.get("/", (req, res) => {
  res.redirect("/login");
});

app.get("/login", (req, res) => {
  if (req.session.userId) {
    return res.redirect("/dashboard");
  }
  res.render("login"); // si no ha iniciado sesión dirigir al login
});

app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = await User.findOne({ where: { username } });
    if (!user) {
      return res.redirect("/login?error=Usuario o contraseña incorrectos");
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.redirect("/login?error=Usuario o contraseña incorrectos");
    }

    req.session.userId = user.id;
    req.session.role = user.role;
    res.redirect("/dashboard");
  } catch (err) {
    console.error(err);
    res.status(500).send("Error en la autenticación");
  }
});

// Rutas para el dashboard
app.get("/dashboard", isAuthenticated, async (req, res) => {
  try {
    const loggedInUser = await User.findByPk(req.session.userId);
    if (loggedInUser.role === "admin") {
      const allUsers = await User.findAll();
      return res.render("adminDashboard", {
        user: loggedInUser,
        users: allUsers,
      });
    } else {
      return res.render("userDashboard", { user: loggedInUser });
    }
  } catch (err) {
    console.error(err);
    res.status(500).send("Error en la consulta");
  }
});

app.get("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).send("Error al cerrar sesión");
    }
    res.redirect("/login");
  });
});

// Rutas CRUD protegidas con isAuthenticated e isAdmin

// Ruta para ver el formulario de creación de usuario
app.get("/users/create", isAuthenticated, isAdmin, (req, res) => {
  res.render("createUser", { error: req.query.error }); // Pasa req.query.error a la vista
});

// Ruta para crear un usuario
app.post("/users", isAuthenticated, isAdmin, async (req, res) => {
  const { name, identification, password, email, role, username } = req.body;
  try {
    // Verificar si el nombre de usuario o la identificación son únicos
    const existingUser = await User.findOne({
      where: {
        [Op.or]: [{ username }, { identification }],
      },
    });

    if (existingUser) {
      return res.redirect(
        `/users/create?error=El nombre de usuario o la identificación ya están en uso`
      );
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await User.create({
      name,
      identification,
      password: hashedPassword,
      email,
      role,
      username,
    });
    res.redirect("/dashboard?success=Usuario creado con éxito");
  } catch (err) {
    console.error(err);
    res.status(500).send("Error al crear el usuario");
  }
});

// Ruta para ver el formulario de edición de usuario
app.get("/users/edit/:id", isAuthenticated, async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);

    // Permitir edición si el usuario es admin o está editando su propia información
    if (req.session.role !== "admin" && req.session.userId !== user.id) {
      return res.status(403).send("Acceso denegado");
    }

    res.render("editUser", { user });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error al obtener el usuario");
  }
});

// Ruta para actualizar un usuario
app.post("/users/update/:id", isAuthenticated, async (req, res) => {
  const { name, identification, password, email, role, username } = req.body;

  try {
    const user = await User.findByPk(req.params.id);

    // Validar que el usuario esté editando su propia información o sea admin
    if (req.session.role !== "admin" && req.session.userId !== user.id) {
      return res.status(403).send("Acceso denegado");
    }

    // Si el usuario que está editando es un admin, no permitir que cambie su propio rol
    if (
      req.session.role === "admin" &&
      req.session.userId === user.id &&
      role !== user.role
    ) {
      return res.redirect(
        `/users/edit/${req.params.id}?error=No puedes cambiar tu propio rol`
      );
    }

    // Verificar si el nombre de usuario o la identificación son únicos
    const existingUser = await User.findOne({
      where: {
        [Op.or]: [
          { username: username, id: { [Op.ne]: req.params.id } },
          { identification: identification, id: { [Op.ne]: req.params.id } },
        ],
      },
    });

    if (existingUser) {
      return res.redirect(
        `/users/edit/${req.params.id}?error=El nombre de usuario o la identificación ya están en uso`
      );
    }

    const hashedPassword = password
      ? await bcrypt.hash(password, 10)
      : user.password;

    // Actualizar el usuario sin modificar el rol si es un admin que se edita a sí mismo
    const updateData = {
      name,
      identification,
      password: hashedPassword,
      email,
      username,
    };

    // Solo permitir modificar el rol si no es el admin editándose a sí mismo
    if (!(req.session.role === "admin" && req.session.userId === user.id)) {
      updateData.role = role;
    }

    await user.update(updateData);

    res.redirect("/dashboard?success=Usuario actualizado con éxito");
  } catch (err) {
    console.error(err);
    res.status(500).send("Error al actualizar el usuario");
  }
});

// Ruta para eliminar un usuario
app.post("/users/delete/:id", isAuthenticated, isAdmin, async (req, res) => {
  try {
    const userToDelete = await User.findByPk(req.params.id);

    // Verificar si el usuario que intenta eliminar es el administrador
    if (userToDelete.id === req.session.userId) {
      return res.redirect(
        "/dashboard?error=No puedes eliminar tu propia cuenta"
      );
    }

    // Verificar si el docente tiene proyectos asociados
    const projects = await Project.findAll({
      where: { teacher_id: userToDelete.id },
    });
    if (projects.length > 0) {
      return res.redirect(
        "/dashboard?error=No se puede eliminar al docente porque tiene proyectos vinculados"
      );
    }

    await userToDelete.destroy();
    res.redirect("/dashboard?success=Usuario eliminado con éxito");
  } catch (err) {
    console.error(err);
    res.status(500).send("Error al eliminar el usuario");
  }
});

// Rutas para editar perfil (solo para estudiantes y docentes)
app.get("/profile/edit", isAuthenticated, async (req, res) => {
  const user = await User.findByPk(req.session.userId);
  res.render("editProfile", { user });
});

app.post("/profile/update", isAuthenticated, async (req, res) => {
  const { name, identification, password, email, username } = req.body;

  try {
    const user = await User.findByPk(req.session.userId);

    // Validar la unicidad del nombre de usuario y la identificación
    const existingUserByUsername = await User.findOne({
      where: { username, id: { [Op.ne]: user.id } },
    });
    const existingUserByIdentification = await User.findOne({
      where: { identification, id: { [Op.ne]: user.id } },
    });

    if (existingUserByUsername) {
      return res.redirect(
        `/profile/edit?error=El nombre de usuario ya está en uso`
      );
    }

    if (existingUserByIdentification) {
      return res.redirect(
        `/profile/edit?error=La identificación ya está en uso`
      );
    }

    const hashedPassword = password
      ? await bcrypt.hash(password, 10)
      : user.password;
    await user.update({
      name,
      identification,
      password: hashedPassword,
      email,
      username,
    });
    res.redirect("/dashboard?success=Perfil actualizado con éxito");
  } catch (err) {
    console.error(err);
    res.status(500).send("Error al actualizar el perfil");
  }
});

const Project = require("./models/Project"); // Importar el modelo de proyecto

// Ruta para ver el formulario de creación de proyectos
app.get("/projects/create", isAuthenticated, isAdmin, async (req, res) => {
  const teachers = await User.findAll({ where: { role: "docente" } });
  res.render("createProject", { error: req.query.error, teachers });
});

// Ruta para crear un proyecto
app.post("/projects", isAuthenticated, isAdmin, async (req, res) => {
  const { project_code, project_name, project_type, teacher_id } = req.body;
  try {
    // Verificar si ya existe un proyecto con el mismo código o nombre
    const existingProject = await Project.findOne({
      where: {
        [Op.or]: [{ project_code }, { project_name }],
      },
    });

    if (existingProject) {
      return res.redirect(
        "/projects/create?error=El código o nombre del proyecto ya existen"
      );
    }

    await Project.create({
      project_code,
      project_name,
      project_type,
      teacher_id,
    });
    res.redirect("/projects?success=Proyecto creado con éxito");
  } catch (err) {
    console.error(err);
    res.redirect("/projects/create?error=Error al crear el proyecto");
  }
});

// Ruta para ver el formulario de edición de proyectos
app.get("/projects/edit/:id", isAuthenticated, isAdmin, async (req, res) => {
  try {
    const project = await Project.findByPk(req.params.id);
    const teachers = await User.findAll({ where: { role: "docente" } });
    res.render("editProject", { project, teachers });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error al obtener el proyecto");
  }
});

// Ruta para actualizar un proyecto
app.post("/projects/update/:id", isAuthenticated, isAdmin, async (req, res) => {
  const { project_code, project_name, teacher_id } = req.body;
  const projectId = req.params.id;

  try {
    // Verifica si existe otro proyecto con el mismo `project_code` o `project_name`
    const existingProject = await Project.findOne({
      where: {
        [Op.or]: [{ project_code }, { project_name }],
        id: { [Op.ne]: projectId }, // Excluye el proyecto actual
      },
    });

    if (existingProject) {
      return res.redirect(
        `/projects/edit/${projectId}?error=El código o nombre del proyecto ya están en uso`
      );
    }

    // Si no hay duplicado, actualiza el proyecto
    await Project.update(
      { project_code, project_name, teacher_id },
      { where: { id: projectId } }
    );

    res.redirect("/dashboard?success=Proyecto actualizado con éxito");
  } catch (err) {
    console.error(err);
    res.status(500).send("Error al actualizar el proyecto");
  }
});

// Ruta para eliminar un proyecto
app.post("/projects/delete/:id", isAuthenticated, isAdmin, async (req, res) => {
  try {
    const project = await Project.findByPk(req.params.id);
    await project.destroy();
    res.redirect("/projects?success=Proyecto eliminado con éxito");
  } catch (err) {
    console.error(err);
    res.status(500).send("Error al eliminar el proyecto");
  }
});

// Ruta para ver todos los proyectos
app.get("/projects", isAuthenticated, isAdmin, async (req, res) => {
  try {
    const projects = await Project.findAll(); // Obtener todos los proyectos
    res.render("projectList", { projects }); // Renderizar la vista y pasar los proyectos
  } catch (err) {
    console.error(err);
    res.status(500).send("Error al obtener los proyectos");
  }
});

sequelize.sync().then(() => {
  console.log("Base de datos sincronizada");
  app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
  });
});
