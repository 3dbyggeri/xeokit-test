// API endpoints configuration
export const config = {
    // Base API URL - update this to point to your backend server
    baseUrl: window.location.origin, // This will use the same origin as the client
    
    // API endpoints
    endpoints: {
        projects: '/api/modeldata/projects',
        models: '/api/modeldata/models/',
        xkt: '/api/modeldata/xkt/',
        metadata: '/api/modeldata/json/'
    },
    
    // Default model (fallback if API is not available)
    defaultModel: {
        xktUrl: "https://dl.dropboxusercontent.com/scl/fi/yc7ocuwkle8dfemonlen0/rac_basic_sample_project_3D.xkt?rlkey=sauugwt3nerz3v426y2fchlge&dl=1",
        metadataUrl: "https://dl.dropboxusercontent.com/scl/fi/n44yrra5d6115k6nxorus/rac_basic_sample_project_3D_modelData.json?rlkey=brpdy19qijadvg2zqidsilw2q&dl=1"
    }
}; 