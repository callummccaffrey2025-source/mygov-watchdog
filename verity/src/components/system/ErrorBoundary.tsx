"use client";
import { Component, ReactNode } from "react";
export default class ErrorBoundary extends Component<{children:ReactNode},{hasError:boolean}>{
  state={hasError:false}; static getDerivedStateFromError(){ return {hasError:true}; }
  componentDidCatch(err:any,info:any){ console.error(err,info); }
  render(){ return this.state.hasError ? <div className="p-4 text-white/80">Something went wrong. Please try again.</div> : this.props.children; }
}
