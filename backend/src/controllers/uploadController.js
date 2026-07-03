export async function health(req, res) {
  return res.json({ status: 'success', data: { message: 'Upload API ready' } });
}
