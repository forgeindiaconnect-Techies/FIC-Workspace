// vite.config.docs.js
import { defineConfig } from "file:///D:/New%20folder/node_modules/vite/dist/node/index.js";
import react from "file:///D:/New%20folder/node_modules/@vitejs/plugin-react/dist/index.js";
import tailwindcss from "file:///D:/New%20folder/node_modules/@tailwindcss/vite/dist/index.mjs";
var vite_config_docs_default = defineConfig({
  plugins: [
    react(),
    tailwindcss()
  ],
  server: {
    port: 3040,
    cors: true
  },
  preview: {
    port: 3040,
    cors: true
  },
  build: {
    outDir: "dist/docs",
    target: "esnext"
  }
});
export {
  vite_config_docs_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcuZG9jcy5qcyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiY29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2Rpcm5hbWUgPSBcIkQ6XFxcXE5ldyBmb2xkZXJcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIkQ6XFxcXE5ldyBmb2xkZXJcXFxcdml0ZS5jb25maWcuZG9jcy5qc1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vRDovTmV3JTIwZm9sZGVyL3ZpdGUuY29uZmlnLmRvY3MuanNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tICd2aXRlJztcbmltcG9ydCByZWFjdCBmcm9tICdAdml0ZWpzL3BsdWdpbi1yZWFjdCc7XG5pbXBvcnQgdGFpbHdpbmRjc3MgZnJvbSAnQHRhaWx3aW5kY3NzL3ZpdGUnO1xuXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVDb25maWcoe1xuICBwbHVnaW5zOiBbXG4gICAgcmVhY3QoKSxcbiAgICB0YWlsd2luZGNzcygpXG4gIF0sXG4gIHNlcnZlcjoge1xuICAgIHBvcnQ6IDMwNDAsXG4gICAgY29yczogdHJ1ZSxcbiAgfSxcbiAgcHJldmlldzoge1xuICAgIHBvcnQ6IDMwNDAsXG4gICAgY29yczogdHJ1ZSxcbiAgfSxcbiAgYnVpbGQ6IHtcbiAgICBvdXREaXI6ICdkaXN0L2RvY3MnLFxuICAgIHRhcmdldDogJ2VzbmV4dCdcbiAgfVxufSk7XG4iXSwKICAibWFwcGluZ3MiOiAiO0FBQXlPLFNBQVMsb0JBQW9CO0FBQ3RRLE9BQU8sV0FBVztBQUNsQixPQUFPLGlCQUFpQjtBQUV4QixJQUFPLDJCQUFRLGFBQWE7QUFBQSxFQUMxQixTQUFTO0FBQUEsSUFDUCxNQUFNO0FBQUEsSUFDTixZQUFZO0FBQUEsRUFDZDtBQUFBLEVBQ0EsUUFBUTtBQUFBLElBQ04sTUFBTTtBQUFBLElBQ04sTUFBTTtBQUFBLEVBQ1I7QUFBQSxFQUNBLFNBQVM7QUFBQSxJQUNQLE1BQU07QUFBQSxJQUNOLE1BQU07QUFBQSxFQUNSO0FBQUEsRUFDQSxPQUFPO0FBQUEsSUFDTCxRQUFRO0FBQUEsSUFDUixRQUFRO0FBQUEsRUFDVjtBQUNGLENBQUM7IiwKICAibmFtZXMiOiBbXQp9Cg==
