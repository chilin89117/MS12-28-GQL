import React from 'react';
import Post from '../../components/Feed/Post/Post';
import Button from '../../components/Button/Button';
import FeedEdit from '../../components/Feed/FeedEdit/FeedEdit';
import Input from '../../components/Form/Input/Input';
import Paginator from '../../components/Paginator/Paginator';
import Loader from '../../components/Loader/Loader';
import ErrorHandler from '../../components/ErrorHandler/ErrorHandler';
import './Feed.css';

class Feed extends React.Component {
  state = {
    isEditing: false,
    posts: [],
    totalPosts: 0,
    editPost: null,
    status: '',
    postPage: 1,
    postsLoading: true,
    editLoading: false
  };

  componentDidMount() {
    const gql = {query: `{getUser {status}}`};
    fetch('http://localhost:4000/graphql', {
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
      this.setState({status: resData.data.getUser.status});
    })
    .catch(this.catchError);
    this.loadPosts();
  }

  loadPosts = direction => {
    if (direction) this.setState({postsLoading: true, posts: []});
    let page = this.state.postPage;
    if (direction === 'next') this.setState({postPage: ++page});
    if (direction === 'previous') this.setState({postPage: --page});
    const gql = {
      query: `
        query getPostsOp($page: Int!) {
          getPosts(page: $page) {
            count posts{_id title content imageUrl creator{name} createdAt}
          }
        }
      `,
      variables: {page}
    };
    fetch('http://localhost:4000/graphql', {
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
        posts: resData.data.getPosts.posts.map(p => ({...p, imagePath: p.imageUrl})),
        totalPosts: resData.data.getPosts.count,
        postsLoading: false
      });
    })
    .catch(this.catchError);
  };

  statusUpdateHandler = event => {
    event.preventDefault();
    const gql = {
      query: `
        mutation updateStatusOp($status: String!) {
          updateStatus(status: $status) {status}
        }
      `,
      variables: {status: this.state.status}
    };
    fetch('http://localhost:4000/graphql', {
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
      console.log('Update status: ', resData.data.updateStatus.status);
    })
    .catch(this.catchError);
  };

  newPostHandler = () => {
    this.setState({isEditing: true});
  };

  startEditPostHandler = postId => {
    this.setState(prevState => {
      const loadedPost = {...prevState.posts.find(p => p._id === postId)};
      return {
        isEditing: true,
        editPost: loadedPost
      };
    });
  };

  cancelEditHandler = () => {
    this.setState({isEditing: false, editPost: null});
  };

  finishEditHandler = postData => {
    this.setState({editLoading: true});
    // send image using REST, wait for response, then send post using GQL
    const formData = new FormData();
    formData.append('image', postData.image);
    if(this.state.editPost) formData.append('oldImgPath', this.state.editPost.imageUrl);
    fetch('http://localhost:4000/post-image', {
      method: 'PUT',
      headers: {Authorization: `Bearer ${this.props.token}`},
      body: formData
    })
    .then(res => res.json())
    .then(fileResData => {
      // path may be 'undefined' if no new image is provided on update
      if(fileResData.path) fileResData.path = fileResData.path.replace('\\', '/');
      let gql;
      if(this.state.editPost) {
        gql = {
          query: `
            mutation updateOp($id: ID! $t: String! $c: String! $i: String) {
              updatePost(id: $id, input: {title: $t content: $c imageUrl: $i}) {
                _id title content imageUrl creator{name} createdAt
              }
            }
          `,
          variables: {
            id: this.state.editPost._id,
            t: postData.title,
            c: postData.content,
            i: fileResData.path || 'undefined'
          }
        };
      } else {
        gql = {
          query: `
            mutation createOp($t: String! $c: String! $i: String!) {
              createPost(input: {title: $t content: $c imageUrl: $i}) {
                _id title content imageUrl creator{name} createdAt
              }
            }
          `,
          variables: {t: postData.title, c: postData.content, i: fileResData.path}
        };
      }
      return fetch('http://localhost:4000/graphql', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.props.token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(gql)
      });
    })
    .then(res => res.json())
    .then(resData => {
      if(resData.errors) throw new Error(resData.errors[0].message);
      const resDataField = this.state.editPost ? 'updatePost' : 'createPost';
      const post = {
        _id: resData.data[resDataField]._id,
        title: resData.data[resDataField].title,
        content: resData.data[resDataField].content,
        imageUrl: resData.data[resDataField].imageUrl,
        creator: resData.data[resDataField].creator,
        createdAt: resData.data[resDataField].createdAt
      };
      this.setState(prevState => {
        let updatedPosts = [...prevState.posts];
        let updatedTotalPosts = prevState.totalPosts;
        if(prevState.editPost) {
          const postIndex = prevState.posts.findIndex(p => p._id === prevState.editPost._id);
          updatedPosts[postIndex] = post;
        } else {
          updatedTotalPosts++;
          if (prevState.posts.length >= 2) updatedPosts.pop();
          updatedPosts.unshift(post);
        }
        return {
          posts: updatedPosts,
          isEditing: false,
          editPost: null,
          editLoading: false,
          totalPosts: updatedTotalPosts
        }
      });
    })
    .catch(err => {
      console.error(err);
      this.setState({
        isEditing: false,
        editPost: null,
        editLoading: false,
        error: err
      });
    });
  };

  statusInputChangeHandler = (input, value) => {
    this.setState({status: value});
  };

  deletePostHandler = id => {
    this.setState({postsLoading: true});
    const gql = {
      query: `
        mutation delOp($id: ID!) {
          deletePost(id: $id)
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
      this.loadPosts();
    })
    .catch(err => {
      console.error(err);
      this.setState({postsLoading: false});
    });
  };

  errorHandler = () => {
    this.setState({error: null});
  };

  catchError = error => {
    this.setState({error: error});
  };

  render() {
    return (
      <>
        <ErrorHandler error={this.state.error} onHandle={this.errorHandler} />
        <FeedEdit
          editing={this.state.isEditing}
          selectedPost={this.state.editPost}
          loading={this.state.editLoading}
          onCancelEdit={this.cancelEditHandler}
          onFinishEdit={this.finishEditHandler}
        />
        <section className="feed__status">
          <form onSubmit={this.statusUpdateHandler}>
            <Input
              type="text"
              placeholder="Your status"
              control="input"
              onChange={this.statusInputChangeHandler}
              value={this.state.status}
            />
            <Button mode="flat" type="submit">
              Update
            </Button>
          </form>
        </section>
        <section className="feed__control">
          <Button mode="raised" design="accent" onClick={this.newPostHandler}>
            New Post
          </Button>
        </section>
        <section className="feed">
          {this.state.postsLoading && (
            <div style={{textAlign: 'center', marginTop: '2rem'}}>
              <Loader />
            </div>
          )}
          {this.state.posts.length <= 0 && !this.state.postsLoading ? (
            <p style={{textAlign: 'center'}}>No posts found.</p>
          ) : null}
          {!this.state.postsLoading && (
            <Paginator
              onPrevious={this.loadPosts.bind(this, 'previous')}
              onNext={this.loadPosts.bind(this, 'next')}
              lastPage={Math.ceil(this.state.totalPosts / 2)}
              currentPage={this.state.postPage}
            >
              {this.state.posts.map(post => (
                <Post
                  key={post._id}
                  id={post._id}
                  author={post.creator.name}
                  date={new Date(post.createdAt).toLocaleDateString('en-US')}
                  title={post.title}
                  image={post.imageUrl}
                  content={post.content}
                  onStartEdit={this.startEditPostHandler.bind(this, post._id)}
                  onDelete={this.deletePostHandler.bind(this, post._id)}
                />
              ))}
            </Paginator>
          )}
        </section>
      </>
    );
  }
}

export default Feed;
