// BARI as a real 3D character: signed-distance raymarching in a WebGL2 fragment shader.
window.makeBari3D = function (canvas) {
  const gl = canvas.getContext('webgl2', { premultipliedAlpha: false, preserveDrawingBuffer: true, alpha: true });
  const vs = `#version 300 es
  in vec2 p; void main(){ gl_Position = vec4(p,0.,1.); }`;
  const fs = `#version 300 es
  precision highp float;
  out vec4 o;
  uniform vec2 R; uniform float T, YAW, BOUNCE, SQUASH, WAVE, PITCH, BLINK, SMILE;
  mat2 rot(float a){float c=cos(a),s=sin(a);return mat2(c,-s,s,c);}
  float sdEll(vec3 p, vec3 r){ float k0=length(p/r); float k1=length(p/(r*r)); return k0*(k0-1.0)/k1; }
  float sdCap(vec3 p, vec3 a, vec3 b, float r){ vec3 pa=p-a, ba=b-a; float h=clamp(dot(pa,ba)/dot(ba,ba),0.,1.); return length(pa-ba*h)-r; }
  float smin(float a,float b,float k){ float h=clamp(.5+.5*(b-a)/k,0.,1.); return mix(b,a,h)-k*h*(1.-h); }
  // material ids: 1 body, 2 eye, 3 sprout stem, 4 leaf, 5 foot, 6 glint
  vec2 mapB(vec3 p){
    p.y -= BOUNCE; p.y /= SQUASH; p.xz *= 1.0/sqrt(SQUASH);
    p.yz = rot(PITCH)*p.yz;
    p.xz = rot(YAW)*p.xz;
    float body = sdEll(p, vec3(1.0,1.04,0.94));
    // arms
    vec3 pl=p-vec3(-0.95,-0.12,0.12); pl.xy=rot(0.5)*pl.xy;
    float armL = sdEll(pl, vec3(0.17,0.3,0.17));
    vec3 pr=p-vec3(0.93+0.15*WAVE,-0.05+0.45*WAVE,0.12); pr.xy=rot(-0.5+1.6*WAVE)*pr.xy;
    float armR = sdEll(pr, vec3(0.17,0.3,0.17));
    body = smin(body, min(armL,armR), 0.08);
    // tail
    vec3 tp=p-vec3(0.95,-0.45,-0.6); float tail = abs(length(tp.xy)-0.22)-0.0; tail = length(vec2(length(tp.xy)-0.22, tp.z))-0.09; tail = max(tail, -(tp.x+tp.y*0.2-0.0)); tail=min(tail, sdCap(p, vec3(0.6,-0.7,-0.5), vec3(0.95,-0.67,-0.6), 0.09));
    body = smin(body, tail, 0.1);
    vec2 r = vec2(body, 1.0);
    float feet = min(sdEll(p-vec3(-0.33,-1.02,0.18), vec3(0.22,0.12,0.26)), sdEll(p-vec3(0.33,-1.02,0.18), vec3(0.22,0.12,0.26)));
    if(feet<r.x) r=vec2(feet,5.0);
    float eyeY = 0.2; float ez = mix(0.115, 0.012, BLINK);
    float eyes = min(sdEll(p-vec3(-0.25,eyeY,0.9), vec3(0.095,ez,0.07)), sdEll(p-vec3(0.25,eyeY,0.9), vec3(0.095,ez,0.07)));
    if(eyes<r.x) r=vec2(eyes,2.0);
    float gl1 = min(length(p-vec3(-0.21,eyeY+0.05*(1.-BLINK),0.98))-0.035, length(p-vec3(0.29,eyeY+0.05*(1.-BLINK),0.98))-0.035);
    if(BLINK<0.5 && gl1<r.x) r=vec2(gl1,6.0);
    float stem = sdCap(p, vec3(0.,0.98,0.), vec3(0.03,1.24,0.), 0.045);
    if(stem<r.x) r=vec2(stem,3.0);
    vec3 q=p-vec3(0.17,1.28,0.); q.xy=rot(-0.6)*q.xy; float leaf1=sdEll(q, vec3(0.18,0.07,0.1));
    vec3 q2=p-vec3(-0.1,1.33,0.); q2.xy=rot(0.7)*q2.xy; float leaf2=sdEll(q2, vec3(0.13,0.055,0.08));
    float lf=min(leaf1,leaf2); if(lf<r.x) r=vec2(lf,4.0);
    return r;
  }
  vec3 local(vec3 p){ p.y -= BOUNCE; p.y /= SQUASH; p.xz *= 1.0/sqrt(SQUASH); p.yz = rot(PITCH)*p.yz; p.xz = rot(YAW)*p.xz; return p; }
  vec3 nrm(vec3 p){ vec2 e=vec2(0.002,0.); return normalize(vec3(mapB(p+e.xyy).x-mapB(p-e.xyy).x, mapB(p+e.yxy).x-mapB(p-e.yxy).x, mapB(p+e.yyx).x-mapB(p-e.yyx).x)); }
  float star(vec2 p, float r){ p=abs(p); float d = pow(p.x,0.55)+pow(p.y,0.55); return d - pow(r,0.55); }
  void main(){
    vec2 uv = (gl_FragCoord.xy - 0.5*R)/R.y;
    vec3 ro = vec3(0.,0.12,5.2), rd = normalize(vec3(uv, -1.25));
    float t=0.; vec2 h=vec2(0.);
    for(int i=0;i<90;i++){ h = mapB(ro+rd*t); if(h.x<0.0015||t>9.) break; t += h.x*0.9; }
    if(t>9.){ o=vec4(0.); return; }
    vec3 p = ro+rd*t, n = nrm(p), lp = local(p);
    vec3 L = normalize(vec3(-0.5,0.8,0.7)), V=-rd, H=normalize(L+V);
    vec3 base;
    float spec=0.35, shin=48.;
    if(h.y<1.5){
      base = mix(vec3(0.33,0.27,0.92), vec3(0.58,0.52,1.0), smoothstep(-0.8,0.9,lp.y));
      // face patch (cream), on the front of the body
      vec2 f = (lp.xy - vec2(0.,0.12))/vec2(0.66,0.47);
      float face = (1.-smoothstep(0.92,1.0,dot(f,f))) * step(0.25,lp.z);
      base = mix(base, vec3(1.0,0.95,0.88), face);
      // blush
      float bl = exp(-dot(lp.xy-vec2(-0.47,-0.02),lp.xy-vec2(-0.47,-0.02))*55.) + exp(-dot(lp.xy-vec2(0.47,-0.02),lp.xy-vec2(0.47,-0.02))*55.);
      base = mix(base, vec3(1.0,0.55,0.6), 0.55*bl*step(0.3,lp.z));
      // smile
      float sm = abs(lp.y - (-0.09 + SMILE*2.2*lp.x*lp.x)) ; float mo = (1.-smoothstep(0.012,0.022,sm))*step(abs(lp.x),0.13)*step(0.6,lp.z);
      base = mix(base, vec3(0.55,0.18,0.25), mo);
      // star on the belly (glows)
      float st = star(lp.xy-vec2(0.,-0.62), 0.16);
      float glow = exp(-dot(lp.xy-vec2(0.,-0.62),lp.xy-vec2(0.,-0.62))*9.)*step(0.2,lp.z);
      base = mix(base, vec3(1.0,0.86,0.45), 0.45*glow);
      if(st<0. && lp.z>0.3){ o=vec4(vec3(1.0,0.93,0.55),1.); return; }
    } else if(h.y<2.5){ base=vec3(0.11,0.1,0.22); spec=0.9; shin=90.; }
    else if(h.y<3.5){ base=vec3(0.55,0.36,0.2); }
    else if(h.y<4.5){ base=vec3(0.45,0.78,0.3); }
    else if(h.y<5.5){ base=vec3(0.28,0.22,0.78); }
    else { o=vec4(1.,1.,1.,1.); return; }
    float dif = clamp(dot(n,L),0.,1.);
    float fill = clamp(dot(n,normalize(vec3(0.6,0.2,0.8))),0.,1.)*0.35;
    float rim = pow(1.-clamp(dot(n,V),0.,1.),3.)*0.6;
    float amb = 0.38 + 0.2*n.y;
    // soft self-shadow
    float sh=1.; float tt=0.03; for(int i=0;i<24;i++){ float d=mapB(p+L*tt).x; sh=min(sh, 8.*d/tt); tt+=clamp(d,0.02,0.2); if(sh<0.01||tt>3.) break; } sh=clamp(sh,0.,1.);
    vec3 col = base*(amb + 0.85*dif*mix(0.45,1.,sh) + fill) + vec3(0.75,0.7,1.0)*rim*0.6 + vec3(1.)*spec*pow(clamp(dot(n,H),0.,1.),shin)*sh;
    col = pow(col, vec3(0.92));
    o = vec4(col,1.);
  }`;
  function sh(t, s) { const x = gl.createShader(t); gl.shaderSource(x, s); gl.compileShader(x); if (!gl.getShaderParameter(x, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(x)); return x; }
  const pr = gl.createProgram(); gl.attachShader(pr, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(pr);
  if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(pr));
  gl.useProgram(pr);
  const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const U = n => gl.getUniformLocation(pr, n);
  return function draw(s) {
    gl.viewport(0, 0, canvas.width, canvas.height); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform2f(U('R'), canvas.width, canvas.height);
    gl.uniform1f(U('T'), s.t || 0); gl.uniform1f(U('YAW'), s.yaw || 0); gl.uniform1f(U('BOUNCE'), s.bounce || 0);
    gl.uniform1f(U('SQUASH'), s.squash || 1); gl.uniform1f(U('WAVE'), s.wave || 0); gl.uniform1f(U('PITCH'), s.pitch || 0);
    gl.uniform1f(U('BLINK'), s.blink || 0); gl.uniform1f(U('SMILE'), s.smile == null ? 1 : s.smile);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); gl.finish();
  };
};
