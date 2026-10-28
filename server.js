const http = require('http');
const { URL } = require('url');

const todos = [];
let nextId = 1;

const sendJson = (res, statusCode, payload) => {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(JSON.stringify(payload));
};

const parseJsonBody = (req) =>
  new Promise((resolve, reject) => {
    let body = '';

    req.on('data', (chunk) => {
      body += chunk;
    });

    req.on('end', () => {
      if (!body.trim()) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(new Error('Invalid JSON body'));
      }
    });

    req.on('error', reject);
  });

const getTodoById = (id) => todos.find((todo) => todo.id === id);

const createTodo = (payload) => {
  const title = payload?.title;

  if (typeof title !== 'string' || title.trim() === '') {
    const error = new Error('Title is required and must be a non-empty string');
    error.statusCode = 400;
    throw error;
  }

  const todo = {
    id: nextId++,
    title: title.trim(),
    completed: Boolean(payload?.completed ?? false)
  };

  todos.push(todo);
  return todo;
};

const updateTodo = (todo, payload) => {
  if (payload?.title !== undefined) {
    if (typeof payload.title !== 'string' || payload.title.trim() === '') {
      const error = new Error('Title must be a non-empty string');
      error.statusCode = 400;
      throw error;
    }
    todo.title = payload.title.trim();
  }

  if (payload?.completed !== undefined) {
    if (typeof payload.completed !== 'boolean') {
      const error = new Error('Completed must be a boolean');
      error.statusCode = 400;
      throw error;
    }
    todo.completed = payload.completed;
  }

  return todo;
};

const routeHandler = async (req, res) => {
  const requestUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = requestUrl.pathname;
  const method = req.method.toUpperCase();

  if (method === 'OPTIONS') {
    sendJson(res, 204, {});
    return;
  }

  if (pathname === '/' && method === 'GET') {
    sendJson(res, 200, { message: 'Todo API is running' });
    return;
  }

  if (pathname === '/todos' && method === 'GET') {
    sendJson(res, 200, todos);
    return;
  }

  if (pathname === '/todos' && method === 'POST') {
    try {
      const body = await parseJsonBody(req);
      const todo = createTodo(body);
      sendJson(res, 201, todo);
    } catch (error) {
      const statusCode = error.statusCode || 400;
      sendJson(res, statusCode, { error: error.message || 'Bad request' });
    }
    return;
  }

  if (pathname.startsWith('/todos/')) {
    const idParam = pathname.split('/').filter(Boolean)[1];
    const todoId = Number(idParam);

    if (!Number.isInteger(todoId) || todoId <= 0) {
      sendJson(res, 400, { error: 'Todo id must be a positive integer' });
      return;
    }

    const todo = getTodoById(todoId);

    if (method === 'GET') {
      if (!todo) {
        sendJson(res, 404, { error: 'Todo not found' });
        return;
      }

      sendJson(res, 200, todo);
      return;
    }

    if (method === 'PUT') {
      if (!todo) {
        sendJson(res, 404, { error: 'Todo not found' });
        return;
      }

      try {
        const body = await parseJsonBody(req);
        const updatedTodo = updateTodo(todo, body);
        sendJson(res, 200, updatedTodo);
      } catch (error) {
        const statusCode = error.statusCode || 400;
        sendJson(res, statusCode, { error: error.message || 'Bad request' });
      }
      return;
    }

    if (method === 'DELETE') {
      if (!todo) {
        sendJson(res, 404, { error: 'Todo not found' });
        return;
      }

      const index = todos.indexOf(todo);
      todos.splice(index, 1);
      sendJson(res, 200, { message: 'Todo deleted successfully' });
      return;
    }
  }

  sendJson(res, 404, { error: 'Route not found' });
};

const server = http.createServer((req, res) => {
  routeHandler(req, res).catch((error) => {
    sendJson(res, 500, { error: error.message || 'Internal server error' });
  });
});

const startServer = (port = Number(process.env.PORT) || 3000) =>
  server.listen(port, () => {
    console.log(`Todo API running on http://localhost:${port}`);
  });

if (require.main === module) {
  startServer();
}

module.exports = { server, startServer, todos };
