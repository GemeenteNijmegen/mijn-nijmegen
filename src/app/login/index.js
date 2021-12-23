
exports.handler = async (event, context) => {
    try {
        const html = '<html><head><title>Login</title></head><body><h1>Login</h1></body></html>';
        response = {
            'statusCode': 200,
            'body': html,
            'headers': { 
                'Content-type': 'text/html'
            }
        }
    } catch (err) {
        console.log(err);
        return err;
    }

    return response;
};