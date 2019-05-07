import React, { Component } from 'react';

import Image from '../../../components/Image/Image';
import './SinglePost.css';

class SinglePost extends Component {
  state = {
    title: '',
    author: '',
    date: '',
    image: '',
    content: ''
  };

  componentDidMount() {
    const id = this.props.match.params.postId;
    const gql = {
      query: `
        query getOp($id: ID!) {
          getPost(id: $id) {title content imageUrl creator{name} createdAt}
        }
      `,
      variables: {id}
    };
    fetch(`http://localhost:4000/graphql`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.props.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(gql)
    })
    .then(res => res.json())
    .then(resData => {
      if(resData.errors) throw new Error(resData.errors[0].message);
      this.setState({
        title: resData.data.getPost.title,
        content: resData.data.getPost.content,
        image: `http://localhost:4000/${resData.data.getPost.imageUrl}`,
        author: resData.data.getPost.creator.name,
        date: new Date(resData.data.getPost.createdAt).toLocaleDateString('en-US')
      });
    })
    .catch(err => {
      console.log(err);
    });
  }

  render() {
    return (
      <section className="single-post">
        <h1>{this.state.title}</h1>
        <h2>
          Created by {this.state.author} on {this.state.date}
        </h2>
        <div className="single-post__image">
          <Image contain imageUrl={this.state.image} />
        </div>
        <p>{this.state.content}</p>
      </section>
    );
  }
}

export default SinglePost;
