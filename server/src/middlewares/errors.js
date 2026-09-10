export function notFound(request, response) {
  response.status(404).json({ message: `Rota não encontrada: ${request.method} ${request.path}` });
}

export function errorHandler(error, request, response, next) {
  console.error(error);
  if (error.code === 'ER_DUP_ENTRY') {
    return response.status(409).json({ message: 'Já existe um registo com estes dados.' });
  }
  if (error.name === 'MulterError') {
    return response.status(400).json({ message: error.message });
  }
  return response.status(error.status || 500).json({ message: error.message || 'Erro interno do servidor.' });
}

